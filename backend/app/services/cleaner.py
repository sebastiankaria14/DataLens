import polars as pl
from typing import Optional, List
from pathlib import Path


class DataCleaner:
    """Service for cleaning datasets using Polars."""
    
    def clean_dataset(
        self,
        file_path: str,
        file_type: str,
        output_path: str,
        remove_duplicates: bool = False,
        handle_missing: Optional[str] = None,
        remove_outliers: bool = False,
        outlier_method: str = "iqr",
        filter_columns: Optional[List[str]] = None,
        normalize: bool = False
    ) -> dict:
        """
        Clean dataset with specified operations.
        
        Args:
            file_path: Input file path
            file_type: Type of file (csv, excel, json)
            output_path: Output file path
            remove_duplicates: Remove duplicate rows
            handle_missing: How to handle missing values ("drop", "fill_mean", "fill_median", "fill_mode")
            remove_outliers: Remove outlier values
            outlier_method: Method for outlier detection ("iqr", "zscore")
            filter_columns: List of columns to keep (None = keep all)
            normalize: Normalize numeric columns
        
        Returns:
            Dictionary with cleaning statistics
        """
        # Read data
        df = self._read_file(file_path, file_type)
        initial_rows = len(df)
        initial_cols = len(df.columns)
        
        stats = {
            "initial_rows": initial_rows,
            "initial_columns": initial_cols,
            "operations_performed": []
        }
        
        # Filter columns
        if filter_columns:
            df = df.select(filter_columns)
            stats["operations_performed"].append({
                "operation": "filter_columns",
                "columns_kept": len(filter_columns)
            })
        
        # Remove duplicates
        if remove_duplicates:
            before = len(df)
            df = df.unique()
            removed = before - len(df)
            stats["operations_performed"].append({
                "operation": "remove_duplicates",
                "rows_removed": removed
            })
        
        # Handle missing values
        if handle_missing:
            df, missing_stats = self._handle_missing_values(df, handle_missing)
            stats["operations_performed"].append({
                "operation": f"handle_missing_{handle_missing}",
                **missing_stats
            })
        
        # Remove outliers
        if remove_outliers:
            df, outlier_stats = self._remove_outliers(df, outlier_method)
            stats["operations_performed"].append({
                "operation": f"remove_outliers_{outlier_method}",
                **outlier_stats
            })
        
        # Normalize numeric columns
        if normalize:
            df, norm_stats = self._normalize_numeric(df)
            stats["operations_performed"].append({
                "operation": "normalize",
                **norm_stats
            })
        
        # Save cleaned dataset
        self._save_file(df, output_path, file_type)
        
        stats.update({
            "final_rows": len(df),
            "final_columns": len(df.columns),
            "rows_removed": initial_rows - len(df),
            "columns_removed": initial_cols - len(df.columns)
        })
        
        return stats
    
    def _read_file(self, file_path: str, file_type: str) -> pl.DataFrame:
        """Read file into Polars DataFrame."""
        if file_type == "csv":
            return pl.read_csv(file_path)
        elif file_type == "excel":
            return pl.read_excel(file_path)
        elif file_type == "json":
            return pl.read_json(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    
    def _save_file(self, df: pl.DataFrame, file_path: str, file_type: str):
        """Save DataFrame to file."""
        if file_type == "csv":
            df.write_csv(file_path)
        elif file_type == "parquet":
            df.write_parquet(file_path)
        elif file_type == "json":
            df.write_json(file_path)
        else:
            # Default to CSV
            df.write_csv(file_path)
    
    def _handle_missing_values(self, df: pl.DataFrame, method: str) -> tuple:
        """Handle missing values."""
        if method == "drop":
            before = len(df)
            df = df.drop_nulls()
            return df, {"rows_dropped": before - len(df)}
        
        elif method == "fill_mean":
            filled_cols = []
            for col in df.columns:
                if df[col].dtype in [pl.Int64, pl.Int32, pl.Float64, pl.Float32]:
                    mean_val = df[col].mean()
                    if mean_val is not None:
                        df = df.with_columns(df[col].fill_null(mean_val))
                        filled_cols.append(col)
            return df, {"columns_filled": len(filled_cols)}
        
        elif method == "fill_median":
            filled_cols = []
            for col in df.columns:
                if df[col].dtype in [pl.Int64, pl.Int32, pl.Float64, pl.Float32]:
                    median_val = df[col].median()
                    if median_val is not None:
                        df = df.with_columns(df[col].fill_null(median_val))
                        filled_cols.append(col)
            return df, {"columns_filled": len(filled_cols)}
        
        elif method == "fill_mode":
            filled_cols = []
            for col in df.columns:
                mode_val = df[col].mode().first()
                if mode_val is not None:
                    df = df.with_columns(df[col].fill_null(mode_val))
                    filled_cols.append(col)
            return df, {"columns_filled": len(filled_cols)}
        
        return df, {}
    
    def _remove_outliers(self, df: pl.DataFrame, method: str) -> tuple:
        """Remove outliers from numeric columns."""
        initial_rows = len(df)
        
        if method == "iqr":
            for col in df.columns:
                if df[col].dtype in [pl.Int64, pl.Int32, pl.Float64, pl.Float32]:
                    Q1 = df[col].quantile(0.25)
                    Q3 = df[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    df = df.filter(
                        (df[col] >= lower_bound) & (df[col] <= upper_bound)
                    )
        
        elif method == "zscore":
            for col in df.columns:
                if df[col].dtype in [pl.Int64, pl.Int32, pl.Float64, pl.Float32]:
                    mean = df[col].mean()
                    std = df[col].std()
                    if std > 0:
                        df = df.filter(
                            ((df[col] - mean) / std).abs() <= 3
                        )
        
        return df, {"rows_removed": initial_rows - len(df)}
    
    def _normalize_numeric(self, df: pl.DataFrame) -> tuple:
        """Normalize numeric columns to 0-1 range."""
        normalized_cols = []
        
        for col in df.columns:
            if df[col].dtype in [pl.Int64, pl.Int32, pl.Float64, pl.Float32]:
                min_val = df[col].min()
                max_val = df[col].max()
                
                if min_val is not None and max_val is not None and max_val > min_val:
                    df = df.with_columns(
                        ((df[col] - min_val) / (max_val - min_val)).alias(col)
                    )
                    normalized_cols.append(col)
        
        return df, {"columns_normalized": len(normalized_cols)}


# Singleton instance
cleaner = DataCleaner()
