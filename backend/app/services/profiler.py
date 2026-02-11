import duckdb
import polars as pl
from typing import Dict, Any, Optional, List
from pathlib import Path


class DataProfiler:
    """Service for profiling datasets using DuckDB."""
    
    def __init__(self):
        pass

    def _sql_string_literal(self, value: str) -> str:
        """Escape a Python string for use as a SQL string literal."""
        return value.replace("'", "''")

    def _scan_expr(self, file_path: str, file_type: str) -> str:
        """Return a DuckDB table function/expression to scan a file."""
        # DuckDB handles forward slashes reliably on Windows.
        normalized_path = str(Path(file_path).resolve()).replace('\\', '/')
        lit = self._sql_string_literal(normalized_path)

        ft = (file_type or "").lower()
        if ft == "parquet":
            return f"read_parquet('{lit}')"
        if ft == "csv":
            return f"read_csv_auto('{lit}', header=true)"
        if ft == "json":
            return f"read_json_auto('{lit}')"

        # Default to extension-based replacement scan
        return f"'{lit}'"
    
    def profile_dataset(self, file_path: str, file_type: str = "parquet") -> Dict[str, Any]:
        """
        Profile a dataset and return comprehensive statistics.
        
        Args:
            file_path: Path to the dataset file (preferably Parquet)
            file_type: Type of file (parquet, csv, excel, json)
        
        Returns:
            Dictionary containing profiling results
        """
        # Use DuckDB to query file directly (no loading into memory)
        conn = duckdb.connect(":memory:")
        scan = self._scan_expr(file_path, file_type)

        # Get basic statistics using DuckDB
        row_count = conn.execute(f"SELECT COUNT(*) FROM {scan}").fetchone()[0]

        # Get column information
        columns_info = conn.execute(f"DESCRIBE SELECT * FROM {scan}").fetchall()
        column_count = len(columns_info)
        
        # Analyze each column with DuckDB (no data loading)
        columns_analysis = {}
        missing_values = {}
        category_distributions = {}
        
        for col_name, col_type, *_ in columns_info:
            col_info = self._analyze_column_duckdb(conn, scan, col_name, col_type, row_count)
            columns_analysis[col_name] = col_info
            missing_values[col_name] = col_info.get("null_count", 0)
            
            # Get category distribution for string/categorical columns
            if col_info.get("is_categorical"):
                category_distributions[col_name] = col_info.get("category_distribution", {})
        
        # Check for duplicates
        duplicates = self._count_duplicates_duckdb(conn, scan)
        
        # Memory usage estimation
        memory_usage = self._estimate_memory_usage(file_path)
        
        # Data quality score
        quality_score = self._calculate_quality_score(
            row_count, missing_values, duplicates
        )
        
        # Detect imbalanced categories
        imbalance_warnings = self._detect_imbalance(category_distributions, row_count)
        
        conn.close()
        
        return {
            "row_count": row_count,
            "column_count": column_count,
            "columns": columns_analysis,
            "missing_values": missing_values,
            "duplicates": duplicates,
            "memory_usage": memory_usage,
            "quality_score": quality_score,
            "data_types": {col[0]: col[1] for col in columns_info},
            "category_distributions": category_distributions,
            "imbalance_warnings": imbalance_warnings
        }
    
    def _analyze_column_duckdb(
        self, conn: duckdb.DuckDBPyConnection, scan: str, col_name: str, col_type: str, total_rows: int
    ) -> Dict[str, Any]:
        """Analyze a single column using DuckDB (no data loading)."""
        info = {
            "name": col_name,
            "dtype": col_type,
        }
        
        # Get null count and unique count
        stats = conn.execute(f"""
            SELECT 
                COUNT(*) - COUNT("{col_name}") as null_count,
                COUNT(DISTINCT "{col_name}") as unique_count
            FROM {scan}
        """).fetchone()
        
        info["null_count"] = stats[0]
        info["null_percentage"] = round(stats[0] / total_rows * 100, 2) if total_rows > 0 else 0
        info["unique_count"] = stats[1]
        
        # Numeric column statistics
        if "INT" in col_type.upper() or "DOUBLE" in col_type.upper() or "FLOAT" in col_type.upper() or "DECIMAL" in col_type.upper():
            numeric_stats = conn.execute(f"""
                SELECT 
                    AVG("{col_name}") as mean,
                    MEDIAN("{col_name}") as median,
                    STDDEV("{col_name}") as std,
                    MIN("{col_name}") as min,
                    MAX("{col_name}") as max,
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{col_name}") as q25,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{col_name}") as q75
                FROM {scan}
            """).fetchone()
            
            info.update({
                "mean": float(numeric_stats[0]) if numeric_stats[0] is not None else None,
                "median": float(numeric_stats[1]) if numeric_stats[1] is not None else None,
                "std": float(numeric_stats[2]) if numeric_stats[2] is not None else None,
                "min": float(numeric_stats[3]) if numeric_stats[3] is not None else None,
                "max": float(numeric_stats[4]) if numeric_stats[4] is not None else None,
                "q25": float(numeric_stats[5]) if numeric_stats[5] is not None else None,
                "q75": float(numeric_stats[6]) if numeric_stats[6] is not None else None,
            })
            info["is_categorical"] = False
        
        # Categorical/String column statistics
        elif "VARCHAR" in col_type.upper() or "CHAR" in col_type.upper():
            # Check if it's categorical (unique count < 20% of total or < 50 unique values)
            is_categorical = stats[1] < min(total_rows * 0.2, 50)
            info["is_categorical"] = is_categorical
            
            if is_categorical:
                # Get value distribution
                value_counts = conn.execute(f"""
                    SELECT 
                        "{col_name}" as value,
                        COUNT(*) as count,
                        ROUND(COUNT(*) * 100.0 / {total_rows}, 2) as percentage
                    FROM {scan}
                    WHERE "{col_name}" IS NOT NULL
                    GROUP BY "{col_name}"
                    ORDER BY count DESC
                    LIMIT 20
                """).fetchall()
                
                info["top_values"] = [
                    {"value": str(row[0]), "count": int(row[1]), "percentage": float(row[2])}
                    for row in value_counts
                ]
                
                # Category distribution for imbalance detection
                info["category_distribution"] = {
                    str(row[0]): {"count": int(row[1]), "percentage": float(row[2])}
                    for row in value_counts
                }
        
        return info
    
    def _count_duplicates_duckdb(self, conn: duckdb.DuckDBPyConnection, scan: str) -> int:
        """Count duplicate rows using DuckDB."""
        # Compute duplicates as total rows minus distinct rows.
        # This avoids relying on GROUP BY ALL / COUNT(DISTINCT *), which can differ by DuckDB version.
        result = conn.execute(f"""
            WITH total AS (SELECT COUNT(*)::BIGINT AS n FROM {scan}),
                 distinct_rows AS (SELECT COUNT(*)::BIGINT AS n FROM (SELECT DISTINCT * FROM {scan}))
            SELECT (total.n - distinct_rows.n) AS duplicates
            FROM total, distinct_rows
        """).fetchone()
        return int(result[0] or 0)
    
    def _estimate_memory_usage(self, file_path: str) -> str:
        """Estimate memory usage from file size."""
        from pathlib import Path
        file_size = Path(file_path).stat().st_size
        
        if file_size < 1024:
            return f"{file_size} B"
        elif file_size < 1024 ** 2:
            return f"{file_size / 1024:.2f} KB"
        elif file_size < 1024 ** 3:
            return f"{file_size / (1024 ** 2):.2f} MB"
        else:
            return f"{file_size / (1024 ** 3):.2f} GB"
    
    def _detect_imbalance(
        self, category_distributions: Dict[str, Dict], total_rows: int
    ) -> List[Dict[str, Any]]:
        """Detect imbalanced categories and generate warnings."""
        warnings = []
        
        for col_name, distribution in category_distributions.items():
            if len(distribution) < 2:
                continue
            
            counts = [v["count"] for v in distribution.values()]
            percentages = [v["percentage"] for v in distribution.values()]
            
            max_count = max(counts)
            min_count = min(counts)
            
            if min_count > 0:
                imbalance_ratio = max_count / min_count
                
                if imbalance_ratio > 10:
                    warnings.append({
                        "column": col_name,
                        "severity": "SEVERE",
                        "imbalance_ratio": round(imbalance_ratio, 2),
                        "message": f"Column '{col_name}' is severely imbalanced (ratio: {imbalance_ratio:.1f}:1)"
                    })
                elif imbalance_ratio > 3:
                    warnings.append({
                        "column": col_name,
                        "severity": "WARNING",
                        "imbalance_ratio": round(imbalance_ratio, 2),
                        "message": f"Column '{col_name}' is moderately imbalanced (ratio: {imbalance_ratio:.1f}:1)"
                    })
        
        return warnings
    
    
    def _calculate_quality_score(
        self, row_count: int, missing_values: Dict[str, int], duplicates: int
    ) -> float:
        """Calculate data quality score (0-100)."""
        if row_count == 0:
            return 0.0
        
        # Calculate missing value penalty
        total_missing = sum(missing_values.values())
        total_cells = row_count * len(missing_values)
        missing_penalty = (total_missing / total_cells) * 30 if total_cells > 0 else 0
        
        # Calculate duplicate penalty
        duplicate_penalty = (duplicates / row_count) * 20 if row_count > 0 else 0
        
        # Base score
        score = 100 - missing_penalty - duplicate_penalty
        
        return max(0.0, min(100.0, round(score, 2)))


# Singleton instance
profiler = DataProfiler()
