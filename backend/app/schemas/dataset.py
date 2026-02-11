from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any
from ..models.dataset import DatasetStatus


class DatasetBase(BaseModel):
    name: str


class DatasetCreate(DatasetBase):
    pass


class DatasetResponse(DatasetBase):
    id: int
    original_filename: str
    file_type: str
    file_size: int
    status: DatasetStatus
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    profiled_at: Optional[datetime] = None
    cleaned_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DatasetProfile(BaseModel):
    dataset_id: int
    row_count: int
    column_count: int
    columns: Dict[str, Any]
    missing_values: Dict[str, int]
    duplicates: int
    memory_usage: str


class CleaningOptions(BaseModel):
    remove_duplicates: bool = False
    handle_missing: Optional[str] = None  # "drop", "fill_mean", "fill_median", "fill_mode"
    remove_outliers: bool = False
    outlier_method: str = "iqr"  # "iqr", "zscore"
    filter_columns: Optional[list[str]] = None
    normalize: bool = False
