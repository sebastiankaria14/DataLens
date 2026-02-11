import duckdb
from typing import Dict, Any, List, Optional
import json


class SamplingEngine:
    """
    Sampling & Balancing Engine for dataset operations.
    Handles stratified sampling, class balancing, and category filtering.
    """
    
    def __init__(self):
        self.conn = None
    
    def analyze_imbalance(self, parquet_path: str, target_column: str) -> Dict[str, Any]:
        """
        Analyze class imbalance in the dataset.
        
        Args:
            parquet_path: Path to Parquet file
            target_column: Column to analyze for imbalance
        
        Returns:
            Dictionary with imbalance analysis
        """
        self.conn = duckdb.connect(":memory:")
        
        # Get class distribution
        query = f"""
            SELECT 
                {target_column} as class,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
            FROM '{parquet_path}'
            GROUP BY {target_column}
            ORDER BY count DESC
        """
        
        results = self.conn.execute(query).fetchall()
        
        total_count = sum(r[1] for r in results)
        classes = {
            str(r[0]): {
                "count": r[1],
                "percentage": r[2]
            }
            for r in results
        }
        
        # Calculate imbalance ratio (max class / min class)
        counts = [r[1] for r in results]
        imbalance_ratio = max(counts) / min(counts) if min(counts) > 0 else float('inf')
        
        # Determine if dataset is imbalanced
        is_imbalanced = imbalance_ratio > 1.5
        
        # Generate warnings
        warnings = []
        if imbalance_ratio > 10:
            warnings.append("SEVERE: Dataset is severely imbalanced (>10x difference)")
        elif imbalance_ratio > 3:
            warnings.append("WARNING: Dataset is moderately imbalanced (>3x difference)")
        elif imbalance_ratio > 1.5:
            warnings.append("NOTICE: Dataset shows minor imbalance")
        
        self.conn.close()
        
        return {
            "total_count": total_count,
            "classes": classes,
            "imbalance_ratio": round(imbalance_ratio, 2),
            "is_imbalanced": is_imbalanced,
            "warnings": warnings
        }
    
    def stratified_sample(
        self,
        input_path: str,
        output_path: str,
        sample_size: Optional[int] = None,
        sample_fraction: Optional[float] = None,
        stratify_column: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Perform stratified sampling on the dataset.
        
        Args:
            input_path: Path to input Parquet file
            output_path: Path for output Parquet file
            sample_size: Absolute number of samples (mutually exclusive with sample_fraction)
            sample_fraction: Fraction of data to sample (0-1)
            stratify_column: Column to use for stratification
        
        Returns:
            Statistics about the sampling operation
        """
        self.conn = duckdb.connect(":memory:")
        
        if sample_size and sample_fraction:
            raise ValueError("Cannot specify both sample_size and sample_fraction")
        
        if not sample_size and not sample_fraction:
            sample_fraction = 0.1  # Default 10%
        
        if stratify_column:
            # Stratified sampling - maintain class proportions
            if sample_size:
                query = f"""
                    WITH class_counts AS (
                        SELECT 
                            {stratify_column},
                            COUNT(*) as total,
                            ROUND(COUNT(*) * {sample_size} * 1.0 / (SELECT COUNT(*) FROM '{input_path}')) as sample_count
                        FROM '{input_path}'
                        GROUP BY {stratify_column}
                    )
                    SELECT t.*
                    FROM '{input_path}' t
                    INNER JOIN class_counts c ON t.{stratify_column} = c.{stratify_column}
                    WHERE random() <= (c.sample_count * 1.0 / c.total)
                """
            else:
                query = f"""
                    SELECT *
                    FROM '{input_path}'
                    WHERE random() <= {sample_fraction}
                """
        else:
            # Simple random sampling
            if sample_size:
                total = self.conn.execute(f"SELECT COUNT(*) FROM '{input_path}'").fetchone()[0]
                fraction = sample_size / total
                query = f"""
                    SELECT *
                    FROM '{input_path}'
                    WHERE random() <= {fraction}
                """
            else:
                query = f"""
                    SELECT *
                    FROM '{input_path}'
                    WHERE random() <= {sample_fraction}
                """
        
        # Execute and write to Parquet
        self.conn.execute(f"""
            COPY ({query})
            TO '{output_path}'
            (FORMAT PARQUET, COMPRESSION SNAPPY)
        """)
        
        # Get statistics
        original_count = self.conn.execute(f"SELECT COUNT(*) FROM '{input_path}'").fetchone()[0]
        sampled_count = self.conn.execute(f"SELECT COUNT(*) FROM '{output_path}'").fetchone()[0]
        
        self.conn.close()
        
        return {
            "original_count": original_count,
            "sampled_count": sampled_count,
            "sample_rate": round(sampled_count / original_count, 4)
        }
    
    def balance_classes(
        self,
        input_path: str,
        output_path: str,
        target_column: str,
        method: str = "undersample",
        target_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Balance classes in the dataset.
        
        Args:
            input_path: Path to input Parquet file
            output_path: Path for output Parquet file
            target_column: Column containing class labels
            method: "undersample" or "oversample" (undersample recommended)
            target_count: Target count per class (None = use minority class count)
        
        Returns:
            Statistics about balancing operation
        """
        self.conn = duckdb.connect(":memory:")
        
        # Get class distribution
        class_counts = self.conn.execute(f"""
            SELECT {target_column}, COUNT(*) as count
            FROM '{input_path}'
            GROUP BY {target_column}
        """).fetchall()
        
        if not target_count:
            # Use minority class count
            target_count = min(c[1] for c in class_counts)
        
        if method == "undersample":
            # Undersample majority classes to match minority
            queries = []
            for class_value, count in class_counts:
                if isinstance(class_value, str):
                    class_filter = f"'{class_value}'"
                else:
                    class_filter = str(class_value)
                
                if count > target_count:
                    # Undersample
                    fraction = target_count / count
                    queries.append(f"""
                        SELECT * FROM '{input_path}'
                        WHERE {target_column} = {class_filter}
                        AND random() <= {fraction}
                    """)
                else:
                    # Keep all
                    queries.append(f"""
                        SELECT * FROM '{input_path}'
                        WHERE {target_column} = {class_filter}
                    """)
            
            # Combine all queries
            union_query = " UNION ALL ".join(queries)
            
            # Write balanced dataset
            self.conn.execute(f"""
                COPY ({union_query})
                TO '{output_path}'
                (FORMAT PARQUET, COMPRESSION SNAPPY)
            """)
        
        # Get new distribution
        new_counts = self.conn.execute(f"""
            SELECT {target_column}, COUNT(*) as count
            FROM '{output_path}'
            GROUP BY {target_column}
            ORDER BY {target_column}
        """).fetchall()
        
        self.conn.close()
        
        return {
            "original_distribution": {str(c[0]): c[1] for c in class_counts},
            "balanced_distribution": {str(c[0]): c[1] for c in new_counts},
            "target_count": target_count,
            "method": method
        }
    
    def filter_categories(
        self,
        input_path: str,
        output_path: str,
        column: str,
        keep_categories: List[str]
    ) -> Dict[str, Any]:
        """
        Filter dataset to keep only specified categories.
        
        Args:
            input_path: Path to input Parquet file
            output_path: Path for output Parquet file
            column: Column to filter on
            keep_categories: List of category values to keep
        
        Returns:
            Statistics about filtering operation
        """
        self.conn = duckdb.connect(":memory:")
        
        # Build filter string
        if isinstance(keep_categories[0], str):
            categories_str = ", ".join([f"'{c}'" for c in keep_categories])
        else:
            categories_str = ", ".join([str(c) for c in keep_categories])
        
        query = f"""
            SELECT *
            FROM '{input_path}'
            WHERE {column} IN ({categories_str})
        """
        
        original_count = self.conn.execute(f"SELECT COUNT(*) FROM '{input_path}'").fetchone()[0]
        
        # Execute filter and write
        self.conn.execute(f"""
            COPY ({query})
            TO '{output_path}'
            (FORMAT PARQUET, COMPRESSION SNAPPY)
        """)
        
        filtered_count = self.conn.execute(f"SELECT COUNT(*) FROM '{output_path}'").fetchone()[0]
        
        self.conn.close()
        
        return {
            "original_count": original_count,
            "filtered_count": filtered_count,
            "removed_count": original_count - filtered_count,
            "kept_categories": keep_categories
        }


# Singleton instance
sampling_engine = SamplingEngine()
