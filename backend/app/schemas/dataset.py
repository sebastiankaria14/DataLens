from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List
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
    # Legacy fields (kept for backward-compat)
    remove_duplicates: bool = False
    handle_missing: Optional[str] = None  # "drop", "fill_mean", "fill_median", "fill_mode"
    remove_outliers: bool = False
    outlier_method: str = "iqr"   # "iqr" | "zscore"
    outlier_action: str = "remove"  # "remove" | "cap"
    filter_columns: Optional[List[str]] = None
    normalize: bool = False
    # Extended pipeline fields
    missing_strategy_map: Optional[Dict[str, str]] = None
    convert_types: Optional[Dict[str, str]] = None
    encode_categoricals: bool = False
    balance_target: Optional[str] = None
    balance_method: str = "undersample"  # "undersample" | "oversample"


class MLReadinessResponse(BaseModel):
    dataset_quality_score: float
    ml_readiness_score: int
    score_breakdown: Dict[str, float]
    issues_remaining: List[str]
    recommendations: List[str]
    low_variance_features: List[str]
    high_missing_columns: List[str]
    severe_imbalance: bool


class FeatureEngineeringSuggestions(BaseModel):
    drop_columns: List[str]
    normalize_columns: List[str]
    encode_columns: List[str]
    create_features: List[Dict[str, str]]
    correlated_pairs: List[Dict[str, Any]]


class MLAnalysisResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    ml_readiness: Dict[str, Any]
    feature_suggestions: Dict[str, Any]
    target_columns: List[str]
    model_recommendations: Dict[str, Any]


class MLPrepareOptions(BaseModel):
    target_column: Optional[str] = None
    test_size: float = 0.2
    normalize: bool = True
    encode: bool = True
