import duckdb
import polars as pl
from pathlib import Path
from typing import Optional


class ParquetConverter:
    """Service to convert uploaded datasets to Parquet format for optimal DuckDB performance."""
    
    def convert_to_parquet(
        self,
        input_path: str,
        file_type: str,
        output_dir: str = "./parquet"
    ) -> str:
        """
        Convert uploaded file to Parquet format.
        
        Args:
            input_path: Path to the input file
            file_type: Type of file (csv, excel, json)
            output_dir: Directory to store Parquet files
        
        Returns:
            Path to the created Parquet file
        """
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Generate output filename
        input_file = Path(input_path)
        output_filename = f"{input_file.stem}.parquet"
        output_path = Path(output_dir) / output_filename
        
        # Read data based on file type
        if file_type == "csv":
            df = pl.read_csv(input_path)
        elif file_type == "excel":
            df = pl.read_excel(input_path)
        elif file_type == "json":
            df = pl.read_json(input_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
        
        # Write to Parquet with optimal settings
        df.write_parquet(
            output_path,
            compression="snappy",  # Good balance of speed and compression
            statistics=True,       # Enable column statistics for DuckDB
            row_group_size=122880  # Optimal for DuckDB
        )
        
        return str(output_path)
    
    def get_parquet_info(self, parquet_path: str) -> dict:
        """Get information about a Parquet file."""
        conn = duckdb.connect(":memory:")
        
        # Get basic info
        info = conn.execute(f"""
            SELECT 
                COUNT(*) as row_count,
                COUNT(DISTINCT *) as unique_rows
            FROM '{parquet_path}'
        """).fetchone()
        
        # Get column info
        columns = conn.execute(f"""
            DESCRIBE SELECT * FROM '{parquet_path}'
        """).fetchall()
        
        conn.close()
        
        return {
            "row_count": info[0],
            "unique_rows": info[1],
            "columns": [
                {"name": col[0], "type": col[1]}
                for col in columns
            ]
        }


# Singleton instance
parquet_converter = ParquetConverter()
