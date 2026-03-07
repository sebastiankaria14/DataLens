import duckdb
import polars as pl
from typing import Dict, Any, Optional, List
from pathlib import Path


# ---------------------------------------------------------------------------
# Domain / ML-type keyword tables
# ---------------------------------------------------------------------------
_DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    "Finance / Stock Market": [
        "price", "stock", "open", "close", "high", "low", "volume", "ticker",
        "symbol", "market", "dividend", "return", "revenue", "profit", "loss",
        "cost", "salary", "income", "expense", "budget", "fund", "asset",
        "equity", "bond", "gdp", "inflation", "currency", "rate",
    ],
    "Healthcare / Medical": [
        "patient", "diagnosis", "disease", "treatment", "hospital", "doctor",
        "age", "bmi", "blood", "glucose", "cholesterol", "symptom",
        "prescription", "health", "medical", "clinical", "drug", "dose",
        "mortality", "survival", "cancer", "heart", "pressure",
    ],
    "Sports / Athletics": [
        "player", "team", "goal", "score", "match", "season", "league",
        "win", "loss", "draw", "assist", "position", "club", "points",
        "rank", "game", "sport", "athlete", "tournament", "fixture",
        "appearance", "minute", "assist", "striker", "defender",
    ],
    "E-commerce / Retail": [
        "product", "sale", "order", "customer", "quantity", "discount",
        "category", "rating", "review", "shipping", "inventory", "purchase",
        "cart", "checkout", "item", "sku", "brand", "store",
    ],
    "Human Resources": [
        "employee", "staff", "department", "role", "hire", "schedule",
        "attendance", "performance", "leave", "job", "work", "shift",
        "present", "absent", "service", "designation",
    ],
    "Transportation / Logistics": [
        "trip", "route", "departure", "arrival", "distance", "duration",
        "vehicle", "flight", "passenger", "origin", "destination", "delay",
        "freight", "carrier", "tracking", "shipment",
    ],
    "Education": [
        "student", "grade", "course", "teacher", "school", "score",
        "exam", "subject", "attendance", "lecture", "marks", "class",
        "gpa", "semester",
    ],
    "Climate / Environment": [
        "temperature", "humidity", "wind", "rain", "precipitation",
        "weather", "climate", "air", "pollution", "carbon", "sensor",
        "pressure", "visibility", "uv",
    ],
    "Social Media / NLP": [
        "text", "tweet", "post", "comment", "message", "sentiment",
        "review", "content", "likes", "followers", "mention", "hashtag",
    ],
}

_DOMAIN_ICONS: Dict[str, str] = {
    "Finance / Stock Market": "💹",
    "Healthcare / Medical": "🏥",
    "Sports / Athletics": "⚽",
    "E-commerce / Retail": "🛒",
    "Human Resources": "👥",
    "Transportation / Logistics": "✈️",
    "Education": "🎓",
    "Climate / Environment": "🌍",
    "Social Media / NLP": "💬",
}

_NUMERIC_MARKERS = ("INT", "DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC", "BIGINT", "SMALLINT")
_TEXT_MARKERS = ("VARCHAR", "CHAR", "TEXT", "STRING")
_TIME_KEYWORDS = ["date", "time", "year", "month", "week", "day", "timestamp", "period", "quarter"]
_NLP_KEYWORDS = ["text", "comment", "review", "message", "tweet", "post", "description", "content", "sentence", "body"]


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

        # Classify dataset domain and suggest ML project types
        classification = self._classify_dataset(
            column_names=[col[0] for col in columns_info],
            data_types={col[0]: col[1] for col in columns_info},
        )

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
            "imbalance_warnings": imbalance_warnings,
            "domain": classification["domain"],
            "domain_icon": classification["domain_icon"],
            "suitable_for": classification["suitable_for"],
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


    def _classify_dataset(
        self, column_names: List[str], data_types: Dict[str, str]
    ) -> Dict[str, Any]:
        """Infer dataset domain and suggest ML project types from column names and types."""
        cols_lower = [c.lower() for c in column_names]
        types_upper = [t.upper() for t in data_types.values()]
        total_cols = len(column_names)

        # Count column flavours
        num_numeric = sum(1 for t in types_upper if any(m in t for m in _NUMERIC_MARKERS))
        num_text = sum(1 for t in types_upper if any(m in t for m in _TEXT_MARKERS))
        numeric_ratio = num_numeric / total_cols if total_cols else 0

        # Domain detection: score each domain by keyword hits
        best_score, best_domain = 0, "General"
        for domain_name, keywords in _DOMAIN_KEYWORDS.items():
            score = sum(1 for kw in keywords if any(kw in col for col in cols_lower))
            if score > best_score:
                best_score, best_domain = score, domain_name

        domain = best_domain if best_score > 0 else "General"
        domain_icon = _DOMAIN_ICONS.get(domain, "📊")

        # ML project type suggestions
        suitable_for = []

        has_time = any(kw in col for kw in _TIME_KEYWORDS for col in cols_lower)
        has_nlp = any(kw in col for kw in _NLP_KEYWORDS for col in cols_lower)

        if has_time and num_numeric > 0:
            suitable_for.append({"type": "Time Series Forecasting", "icon": "📈", "confidence": "High"})

        if has_nlp:
            suitable_for.append({"type": "NLP / Text Analysis", "icon": "💬", "confidence": "High"})

        if num_numeric > 0 and numeric_ratio >= 0.4:
            suitable_for.append({"type": "Regression", "icon": "📉", "confidence": "High"})

        if num_text > 0 and num_numeric > 0:
            suitable_for.append({"type": "Classification", "icon": "🏷️", "confidence": "High"})
        elif num_numeric > 0:
            suitable_for.append({"type": "Classification", "icon": "🏷️", "confidence": "Medium"})

        if num_numeric >= 3:
            suitable_for.append({"type": "Clustering", "icon": "🔵", "confidence": "Medium"})

        if not suitable_for:
            suitable_for.append({"type": "Exploratory Data Analysis", "icon": "🔍", "confidence": "Medium"})

        return {
            "domain": domain,
            "domain_icon": domain_icon,
            "suitable_for": suitable_for[:4],
        }


# Singleton instance
profiler = DataProfiler()
