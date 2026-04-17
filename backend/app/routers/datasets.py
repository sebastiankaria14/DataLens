from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
import aiofiles
import duckdb
import os
import polars as pl
from pathlib import Path
from datetime import datetime

from ..core.database import get_db
from ..core.database import SessionLocal
from ..core.dependencies import get_current_active_user
from ..core.config import settings
from ..models.user import User
from ..models.dataset import Dataset, DatasetStatus
from ..schemas.dataset import (
    DatasetResponse, DatasetProfile, CleaningOptions,
    MLAnalysisResponse, MLPrepareOptions,
)
from ..services.profiler import profiler
from ..services.cleaner import (
    cleaner,
    clean_dataset_pipeline,
    calculate_ml_readiness,
    generate_feature_engineering_suggestions,
    detect_target_columns,
    recommend_ml_models,
    prepare_ml_dataset,
)
from ..services.parquet_converter import parquet_converter
from ..services.sampling import sampling_engine
from ..services.llm_service import ask_llm
from ..utils.prompt_builder import build_prompt
import json

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


class AIQuestion(BaseModel):
    question: str

# Allowed file extensions
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Convert MB to bytes


def get_file_extension(filename: str) -> str:
    """Get file extension."""
    return Path(filename).suffix.lower()


def get_file_type(filename: str) -> str:
    """Determine file type from extension."""
    ext = get_file_extension(filename)
    if ext == ".csv":
        return "csv"
    elif ext in [".xlsx", ".xls"]:
        return "excel"
    elif ext == ".json":
        return "json"
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def _is_numeric_type(col_type: str) -> bool:
    """Return True if a DuckDB type string looks numeric."""
    if not col_type:
        return False
    upper = col_type.upper()
    return any(token in upper for token in ["INT", "DOUBLE", "FLOAT", "DECIMAL", "REAL"])


def _scan_expression(file_path: str, file_type: str) -> str:
    """Delegate to the profiler's scan expression helper (keeps paths normalized)."""
    return profiler._scan_expr(file_path, file_type)


def _load_preview_rows(dataset: Dataset, limit: int = 50) -> Dict[str, Any]:
    """Return a small preview of the dataset for visualization."""
    if limit < 1:
        limit = 1
    if limit > 500:
        limit = 500

    ft = (dataset.file_type or "").lower()
    path = str(Path(dataset.file_path))

    if ft == "parquet":
        df = pl.scan_parquet(path).limit(limit).collect()
    elif ft == "csv":
        df = pl.scan_csv(path, infer_schema_length=50).limit(limit).collect()
    elif ft == "json":
        df = pl.read_json(path).head(limit)
    else:
        # Fallback: try DuckDB to read whatever format we have
        scan = _scan_expression(path, ft)
        conn = duckdb.connect(":memory:")
        try:
            cursor = conn.execute(f"SELECT * FROM {scan} LIMIT {limit}")
            rows = cursor.fetchall()
            cols = [c[0] for c in cursor.description]
            return {
                "columns": [{"name": c, "dtype": "unknown"} for c in cols],
                "rows": [dict(zip(cols, r)) for r in rows],
            }
        finally:
            conn.close()

    columns = [{"name": name, "dtype": str(dtype)} for name, dtype in df.schema.items()]

    def _coerce(value: Any) -> Any:
        # Polars returns datetime/date objects that FastAPI can JSON-encode, but ensure safety.
        if hasattr(value, "isoformat"):
            return value.isoformat()
        if isinstance(value, Path):
            return str(value)
        return value

    rows = []
    for record in df.to_dicts():
        rows.append({k: _coerce(v) for k, v in record.items()})

    return {
        "columns": columns,
        "rows": rows,
    }


def _generate_ai_description(dataset_name: str, row_count: int, column_count: int,
                             columns_summary: List[Dict[str, Any]], quality_score: Any,
                             duplicates: int, missing_rate: float) -> str:
    """Call LLM to generate a short, human-readable description of the dataset."""
    col_lines = ""
    for c in columns_summary[:15]:
        dtype = c.get("dtype") or "unknown"
        col_lines += f"  - {c['name']} ({dtype})\n"

    prompt = (
        f"You are a data analyst. Give a short 2-3 sentence plain-text description of this dataset. "
        f"Describe what the data likely represents, its purpose, and what analyses could be done with it. "
        f"Do NOT use markdown formatting. Do NOT start with 'This dataset'. Be concise and insightful.\n\n"
        f"Dataset: {dataset_name}\n"
        f"Rows: {row_count}, Columns: {column_count}\n"
        f"Quality Score: {quality_score}/100\n"
        f"Duplicates: {duplicates}, Missing Rate: {missing_rate*100:.1f}%\n"
        f"Columns:\n{col_lines}"
    )

    try:
        raw = ask_llm(prompt)
        # Clean up: strip quotes, markdown, etc.
        desc = raw.strip().strip('"').strip("'").strip()
        # If response is JSON, try to extract message
        if desc.startswith("{"):
            try:
                parsed = json.loads(desc)
                desc = parsed.get("message") or parsed.get("description") or desc
            except Exception:
                pass
        # Limit length
        if len(desc) > 500:
            desc = desc[:497] + "..."
        return desc
    except Exception:
        return ""


def _build_insights(dataset: Dataset) -> Dict[str, Any]:
    """Generate a short dataset insight payload from profile data."""
    profile = dataset.profile_data or {}
    row_count = profile.get("row_count") or dataset.row_count or 0
    column_count = profile.get("column_count") or dataset.column_count or 0
    quality_score = profile.get("quality_score")
    duplicates = profile.get("duplicates", 0)
    columns_info = profile.get("columns") or {}
    missing_values = profile.get("missing_values") or {}
    imbalance_warnings = profile.get("imbalance_warnings") or []

    total_cells = row_count * max(column_count, len(missing_values)) if row_count else 0
    total_missing = sum(missing_values.values()) if missing_values else 0
    missing_rate = (total_missing / total_cells) if total_cells else 0

    columns_summary = []
    for name, info in columns_info.items():
        columns_summary.append({
            "name": name,
            "dtype": info.get("dtype") or (profile.get("data_types") or {}).get(name),
            "null_percentage": info.get("null_percentage"),
            "unique_count": info.get("unique_count"),
            "is_categorical": info.get("is_categorical", False),
        })

    sorted_cols = sorted(columns_summary, key=lambda c: (c.get("null_percentage") or 0), reverse=True)
    focus_columns = [c["name"] for c in sorted_cols[:3]] if sorted_cols else []

    summary_parts = [
        f"{dataset.name} has {row_count:,} rows and {column_count} columns.",
        f"Duplicates detected: {duplicates}." if duplicates else "Duplicates look minimal.",
    ]

    if missing_rate >= 0.05:
        summary_parts.append(f"About {missing_rate*100:.1f}% of the cells are missing; consider imputation or drops.")
    elif missing_rate > 0:
        summary_parts.append("Minor missing values present; light cleaning should suffice.")
    else:
        summary_parts.append("No missing values found in profiling.")

    if quality_score is not None:
        summary_parts.append(f"Data quality score: {quality_score}/100.")

    if focus_columns:
        summary_parts.append(f"Columns to inspect first: {', '.join(focus_columns)}.")

    recommendations = []
    if missing_rate >= 0.05:
        recommendations.append("Plan a missing-value strategy (impute numeric, mode-fill categorical).")
    if duplicates:
        recommendations.append("Run deduplication before modeling to reduce bias.")
    if any(w.get("severity") == "SEVERE" for w in imbalance_warnings):
        recommendations.append("Target is highly imbalanced; consider resampling or class weights.")
    elif imbalance_warnings:
        recommendations.append("Mild imbalance detected; monitor metrics beyond accuracy.")
    if not recommendations:
        recommendations.append("Ready for feature engineering and baseline modeling.")

    # AI description removed to avoid blocking LLM call - moved to separate endpoint
    ai_description = f"Dataset with {row_count:,} rows and {column_count} columns ready for analysis."

    domain = profile.get("domain", "General")
    domain_icon = profile.get("domain_icon", "📊")
    suitable_for = profile.get("suitable_for") or []

    return {
        "summary": " ".join(summary_parts),
        "ai_description": ai_description,
        "quality_score": quality_score,
        "row_count": row_count,
        "column_count": column_count,
        "duplicates": duplicates,
        "missing_rate": missing_rate,
        "columns": columns_summary,
        "imbalance_warnings": imbalance_warnings,
        "recommendations": recommendations,
        "domain": domain,
        "domain_icon": domain_icon,
        "suitable_for": suitable_for,
    }


def _column_visualization(dataset: Dataset, column: str, chart_type: str = "auto", bins: int = 20) -> Dict[str, Any]:
    """Compute histogram/bar/box data for a column using DuckDB without loading full data."""
    profile = dataset.profile_data or {}
    columns_info = profile.get("columns") or {}
    data_types = profile.get("data_types") or {}

    safe_column = column.replace('"', '""')
    dtype = None
    if column in columns_info:
        dtype = columns_info[column].get("dtype")
    if not dtype:
        dtype = data_types.get(column)

    scan = _scan_expression(dataset.file_path, dataset.file_type)
    conn = duckdb.connect(":memory:")

    try:
        if not dtype:
            try:
                dtype_row = conn.execute(f"DESCRIBE SELECT \"{safe_column}\" FROM {scan}").fetchone()
                if dtype_row:
                    dtype = dtype_row[1]
            except Exception:
                dtype = None

        is_numeric = _is_numeric_type(dtype or "")

        if chart_type == "auto":
            chart_type = "histogram" if is_numeric else "bar"

        if chart_type == "box" and not is_numeric:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Box plot is only available for numeric columns.")

        if chart_type in ("histogram", "box") and not is_numeric:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Histogram is only available for numeric columns.")

        if is_numeric:
            stats_row = conn.execute(
                f"""
                SELECT 
                    MIN("{safe_column}") AS min_val,
                    MAX("{safe_column}") AS max_val,
                    AVG("{safe_column}") AS mean,
                    MEDIAN("{safe_column}") AS median,
                    STDDEV("{safe_column}") AS std,
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{safe_column}") AS q25,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{safe_column}") AS q75
                FROM {scan}
                WHERE "{safe_column}" IS NOT NULL
                """
            ).fetchone()

            if not stats_row or stats_row[0] is None:
                return {
                    "chart_type": chart_type,
                    "column": column,
                    "column_type": "numeric",
                    "data": [],
                    "stats": {},
                }

            min_val, max_val, mean_val, median_val, std_val, q25_val, q75_val = stats_row

            stats_payload = {
                "min": float(min_val),
                "max": float(max_val),
                "mean": float(mean_val) if mean_val is not None else None,
                "median": float(median_val) if median_val is not None else None,
                "std": float(std_val) if std_val is not None else None,
                "q25": float(q25_val) if q25_val is not None else None,
                "q75": float(q75_val) if q75_val is not None else None,
            }

            if chart_type == "box":
                return {
                    "chart_type": "box",
                    "column": column,
                    "column_type": "numeric",
                    "data": [],
                    "stats": stats_payload,
                }

            if bins < 3:
                bins = 3
            if bins > 80:
                bins = 80

            if min_val == max_val:
                single_count = conn.execute(
                    f"SELECT COUNT(*) FROM {scan} WHERE \"{safe_column}\" IS NOT NULL"
                ).fetchone()[0] or 0
                hist_data = [{"bin_start": float(min_val), "bin_end": float(max_val), "count": int(single_count)}]
            else:
                # Use FLOOR-based bucketing for broad DuckDB version compatibility
                # (width_bucket was added in DuckDB 0.8; older builds lack it).
                hist_rows = conn.execute(
                    f"""
                    WITH stats AS (
                        SELECT MIN("{safe_column}") AS min_val, MAX("{safe_column}") AS max_val FROM {scan} WHERE "{safe_column}" IS NOT NULL
                    ),
                    bucketed AS (
                        SELECT
                            LEAST(
                                CAST(FLOOR(CAST({bins} AS DOUBLE) * ("{safe_column}" - stats.min_val) / (stats.max_val - stats.min_val)) AS INTEGER),
                                {bins} - 1
                            ) AS bucket
                        FROM {scan}, stats
                        WHERE "{safe_column}" IS NOT NULL
                    )
                    SELECT
                        bucket,
                        COUNT(*) AS count,
                        stats.min_val + (CAST(bucket AS DOUBLE) * (stats.max_val - stats.min_val) / CAST({bins} AS DOUBLE)) AS bin_start,
                        stats.min_val + ((CAST(bucket AS DOUBLE) + 1) * (stats.max_val - stats.min_val) / CAST({bins} AS DOUBLE)) AS bin_end
                    FROM bucketed, (SELECT MIN("{safe_column}") AS min_val, MAX("{safe_column}") AS max_val FROM {scan} WHERE "{safe_column}" IS NOT NULL) stats
                    GROUP BY bucket, stats.min_val, stats.max_val
                    ORDER BY bucket
                    """
                ).fetchall()

                hist_data = [
                    {
                        "bin_start": float(row[2]) if row[2] is not None else 0,
                        "bin_end": float(row[3]) if row[3] is not None else 0,
                        "count": int(row[1] or 0),
                    }
                    for row in hist_rows
                ]

            return {
                "chart_type": "histogram",
                "column": column,
                "column_type": "numeric",
                "data": hist_data,
                "stats": stats_payload,
            }

        # Categorical / bar chart path
        bar_rows = conn.execute(
            f"""
            SELECT "{safe_column}" AS category, COUNT(*) AS count
            FROM {scan}
            WHERE "{safe_column}" IS NOT NULL
            GROUP BY "{safe_column}"
            ORDER BY count DESC
            LIMIT 20
            """
        ).fetchall()

        bar_data = [
            {
                "category": str(row[0]) if row[0] is not None else "(null)",
                "count": int(row[1] or 0),
            }
            for row in bar_rows
        ]

        return {
            "chart_type": "bar",
            "column": column,
            "column_type": "categorical",
            "data": bar_data,
            "stats": {},
        }
    finally:
        conn.close()


def _suggest_target_columns(columns_summary: List[Dict[str, Any]]) -> List[str]:
    """Heuristic target column suggestions: low unique count or name hints."""
    candidates = []
    for col in columns_summary:
        name = (col.get("name") or "").lower()
        unique = col.get("unique_count")
        if any(hint in name for hint in ["target", "label", "class", "outcome"]):
            candidates.append(col["name"])
        elif unique is not None and unique > 1 and unique < 50 and col.get("is_categorical"):
            candidates.append(col["name"])
    # Keep unique order while removing duplicates
    seen = set()
    ordered = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered[:5]

def _build_llm_metadata(dataset: Dataset) -> str:
    profile = dataset.profile_data or {}

    row_count = profile.get("row_count", 0)
    column_count = profile.get("column_count", 0)
    columns = profile.get("columns", {})
    missing_values = profile.get("missing_values", {})

    metadata = f"""
Dataset Name: {dataset.name}
Rows: {row_count}
Columns: {column_count}

Columns:
"""

    for col_name, info in columns.items():
        metadata += f"""
- {col_name}
  Type: {info.get('dtype')}
  Missing: {missing_values.get(col_name, 0)}
  Unique: {info.get('unique_count')}
"""

    return metadata

def _answer_question(question: str, dataset: Dataset, insight: Dict[str, Any]) -> Dict[str, Any]:
    """Lightweight, profile-aware answer generator (no external LLM)."""
    q = (question or "").strip()
    if not q:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question cannot be empty.")

    lower_q = q.lower()
    parts: List[str] = []
    columns_summary = insight.get("columns") or []
    missing_rate = insight.get("missing_rate") or 0
    row_count = insight.get("row_count") or 0
    column_count = insight.get("column_count") or 0
    duplicates = insight.get("duplicates") or 0
    imbalance_warnings = insight.get("imbalance_warnings") or []
    target_candidates = _suggest_target_columns(columns_summary)

    if "row" in lower_q:
        parts.append(f"The dataset holds {row_count:,} rows across {column_count} columns.")

    if "column" in lower_q or "feature" in lower_q:
        feature_names = [c.get("name") for c in columns_summary[:6]]
        if feature_names:
            parts.append(f"Notable columns include: {', '.join(filter(None, feature_names))}.")

    if "missing" in lower_q or "null" in lower_q:
        if missing_rate > 0:
            parts.append(f"Missingness is about {missing_rate*100:.2f}% overall; consider imputation or filtering.")
        else:
            parts.append("Profiling did not detect missing values.")

    if "duplicate" in lower_q:
        parts.append(f"Detected {duplicates} duplicate rows during profiling.")

    if "imbal" in lower_q or "balance" in lower_q:
        if imbalance_warnings:
            warning_texts = [w.get("message") for w in imbalance_warnings if w.get("message")]
            if warning_texts:
                parts.append("Imbalance alerts: " + "; ".join(warning_texts))
        else:
            parts.append("No imbalance warnings were flagged in profiling.")

    if "target" in lower_q or "label" in lower_q or "predict" in lower_q:
        if target_candidates:
            parts.append(f"Candidate target columns: {', '.join(target_candidates)} (categorical with limited unique values).")
        else:
            parts.append("No obvious target column detected; choose the field you want to predict or supply a label.")

    if "ml" in lower_q or "model" in lower_q or "project" in lower_q:
        parts.append("Suggested next steps: baseline EDA, split into train/test, scale numeric features, encode categoricals, then try a simple model (logistic/linear/gradient boosting).")

    if not parts:
        parts.append(insight.get("summary") or "Profiling is available; you can ask about rows, columns, missingness, or targets.")

    return {
        "answer": " ".join(parts),
        "related_columns": target_candidates[:3],
        "recommendations": insight.get("recommendations") or [],
    }


@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a dataset file."""
    # Validate file extension
    file_ext = get_file_extension(file.filename)
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Create upload directory if it doesn't exist
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename (strip any path components just in case)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    original_name = Path(file.filename).name
    safe_filename = f"{current_user.id}_{timestamp}_{original_name}"
    file_path = upload_dir / safe_filename
    
    # Save file
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            
            # Check file size
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB"
                )
            
            await f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Create dataset record
    file_type = get_file_type(file.filename)
    dataset = Dataset(
        name=Path(file.filename).stem,
        original_filename=file.filename,
        file_path=str(file_path),
        file_type=file_type,
        file_size=len(content),
        status=DatasetStatus.UPLOADED,
        owner_id=current_user.id
    )
    
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    # Schedule background profiling
    background_tasks.add_task(profile_dataset_background, dataset.id)
    
    return dataset


def profile_dataset_background(dataset_id: int):
    """Background task to profile dataset."""
    import traceback

    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            return

        try:
            dataset.status = DatasetStatus.PROFILING
            dataset.profile_data = {"stage": "profiling"}
            db.commit()

            # Convert to Parquet for optimal DuckDB performance
            parquet_dir = Path(settings.PROCESSED_DIR) / "parquet"
            parquet_path = parquet_converter.convert_to_parquet(
                dataset.file_path,
                dataset.file_type,
                str(parquet_dir)
            )

            # Update dataset to point to Parquet file
            dataset.file_path = parquet_path
            dataset.file_type = "parquet"
            db.commit()

            # Profile the dataset using DuckDB on Parquet
            profile_data = profiler.profile_dataset(parquet_path, "parquet")

            # Update dataset with profiling results
            dataset.row_count = profile_data.get("row_count")
            dataset.column_count = profile_data.get("column_count")
            dataset.profile_data = profile_data
            flag_modified(dataset, "profile_data")
            dataset.status = DatasetStatus.PROFILED
            dataset.profiled_at = datetime.utcnow()
            db.commit()
        except Exception as e:
            # Persist failure so the UI can show a reason
            dataset.status = DatasetStatus.FAILED
            dataset.profile_data = {
                "stage": "profiling",
                "error": str(e),
                "traceback": traceback.format_exc(),
            }
            flag_modified(dataset, "profile_data")
            db.commit()
            print(f"Profiling failed for dataset {dataset_id}: {str(e)}")
            print(traceback.format_exc())
    finally:
        db.close()


@router.get("/", response_model=List[DatasetResponse])
async def list_datasets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all datasets for current user."""
    datasets = db.query(Dataset).filter(
        Dataset.owner_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    return datasets


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dataset details."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    return dataset


@router.get("/{dataset_id}/profile", response_model=dict)
async def get_dataset_profile(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dataset profiling results."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    if dataset.status not in [DatasetStatus.PROFILED, DatasetStatus.CLEANED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset has not been profiled yet"
        )
    
    if not dataset.profile_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile data is missing. The dataset status indicates it was profiled, but the profile data was not saved. Try re-uploading the dataset."
        )
    
    return dataset.profile_data


@router.get("/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: int,
    limit: int = 20,  # Reduced default from 50 to 20 for faster response
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return a small preview of the dataset rows for quick visualization."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    preview = _load_preview_rows(dataset, limit)
    preview["row_count"] = dataset.row_count
    preview["column_count"] = dataset.column_count
    return preview


@router.get("/{dataset_id}/visualization")
async def get_column_visualization(
    dataset_id: int,
    column: str,
    chart_type: str = "auto",
    bins: int = 15,  # Reduced default from 20 to 15 for faster computation
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return histogram/bar/box data for a given column without sending full dataset."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if not column:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Column is required")

    try:
        return _column_visualization(dataset, column, chart_type, bins)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Visualization failed: {str(e)}")


@router.get("/{dataset_id}/scatter")
async def get_scatter_data(
    dataset_id: int,
    column1: str,
    column2: str,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return sampled (x, y) pairs for two numeric columns — used for scatter plots."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if not column1 or not column2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="column1 and column2 are required")

    limit = max(1, min(limit, 2000))
    safe_col1 = column1.replace('"', '""')
    safe_col2 = column2.replace('"', '""')
    scan = _scan_expression(dataset.file_path, dataset.file_type)
    conn = duckdb.connect(":memory:")
    try:
        rows = conn.execute(
            f"""
            SELECT "{safe_col1}" AS x, "{safe_col2}" AS y
            FROM {scan}
            WHERE "{safe_col1}" IS NOT NULL AND "{safe_col2}" IS NOT NULL
            LIMIT {limit}
            """
        ).fetchall()
        data = []
        for r in rows:
            try:
                data.append({"x": float(r[0]), "y": float(r[1])})
            except (TypeError, ValueError):
                pass
        return {"column1": column1, "column2": column2, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Scatter plot failed: {str(e)}")
    finally:
        conn.close()


@router.get("/{dataset_id}/correlation")
async def get_correlation_matrix(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return pairwise Pearson correlation matrix for all numeric columns (capped at 15)."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    profile = dataset.profile_data or {}
    columns_info = profile.get("columns") or {}

    numeric_cols = [
        name for name, info in columns_info.items()
        if _is_numeric_type(info.get("dtype") or "")
    ]

    if len(numeric_cols) < 2:
        return {"columns": numeric_cols, "matrix": []}

    if len(numeric_cols) > 15:
        numeric_cols = numeric_cols[:15]

    scan = _scan_expression(dataset.file_path, dataset.file_type)
    conn = duckdb.connect(":memory:")
    try:
        n = len(numeric_cols)
        matrix: List[List[float]] = [[0.0] * n for _ in range(n)]
        for i in range(n):
            matrix[i][i] = 1.0
            for j in range(i + 1, n):
                sc_i = numeric_cols[i].replace('"', '""')
                sc_j = numeric_cols[j].replace('"', '""')
                try:
                    row = conn.execute(
                        f'SELECT CORR("{sc_i}", "{sc_j}") FROM {scan} WHERE "{sc_i}" IS NOT NULL AND "{sc_j}" IS NOT NULL'
                    ).fetchone()
                    corr = float(row[0]) if row and row[0] is not None else 0.0
                    if corr != corr:  # NaN check
                        corr = 0.0
                except Exception:
                    corr = 0.0
                matrix[i][j] = corr
                matrix[j][i] = corr
        return {"columns": numeric_cols, "matrix": matrix}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Correlation failed: {str(e)}")
    finally:
        conn.close()


@router.get("/{dataset_id}/insights")
async def dataset_insights(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return a short description and recommendations based on profiling."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if dataset.status not in [DatasetStatus.PROFILED, DatasetStatus.CLEANED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset has not been profiled yet")

    return _build_insights(dataset)


@router.post("/{dataset_id}/ai")
async def dataset_ai_qa(
    dataset_id: int,
    payload: AIQuestion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Provide lightweight, profile-aware answers about the dataset without external LLMs."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if dataset.status not in [DatasetStatus.PROFILED, DatasetStatus.CLEANED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset has not been profiled yet")

    metadata = _build_llm_metadata(dataset)

    prompt = build_prompt(metadata, payload.question)

    llm_response = ask_llm(prompt)

    try:
        return json.loads(llm_response)
    except:
        return {"type": "text", "message": llm_response}



@router.post("/{dataset_id}/clean")
async def clean_dataset(
    dataset_id: int,
    options: CleaningOptions,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Clean dataset with specified options. Runs pipeline in background."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    if dataset.status not in [DatasetStatus.PROFILED, DatasetStatus.CLEANED, DatasetStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset must be profiled before cleaning."
        )

    # Mark as cleaning immediately so status endpoint reflects it
    dataset.status = DatasetStatus.CLEANING
    db.commit()

    background_tasks.add_task(clean_dataset_background, dataset_id, options.model_dump())

    return {"message": "Dataset cleaning started", "dataset_id": dataset_id}


def clean_dataset_background(dataset_id: int, options: dict):
    """Background task: run full cleaning pipeline on the parquet dataset."""
    import traceback
    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            return

        try:
            # Determine cleaned output directory
            cleaned_dir = str(Path(settings.PROCESSED_DIR) / "cleaned")

            # Convert non-parquet files to parquet first before running pipeline
            if dataset.file_type != "parquet":
                parquet_dir = Path(settings.PROCESSED_DIR) / "parquet"
                parquet_path = parquet_converter.convert_to_parquet(
                    dataset.file_path,
                    dataset.file_type,
                    str(parquet_dir),
                )
                dataset.file_path = parquet_path
                dataset.file_type = "parquet"
                db.commit()

            # Run the cleaning pipeline
            cleaned_path, cleaning_stats = clean_dataset_pipeline(
                dataset_path=dataset.file_path,
                options=options,
                output_dir=cleaned_dir,
            )

            # Read the cleaned file to get the updated row/column counts
            import polars as _pl
            cleaned_schema = _pl.scan_parquet(cleaned_path).schema
            cleaned_row_count = cleaning_stats.get("final_rows") or dataset.row_count
            cleaned_col_count = len(cleaned_schema)

            # Build updated profile_data (preserve existing profiling, overlay cleaning info)
            profile = dict(dataset.profile_data or {})
            profile["cleaning_stats"] = cleaning_stats
            # Reflect the reduced row count in profile so UI shows correct numbers
            if cleaning_stats.get("final_rows") is not None:
                profile["row_count"] = cleaning_stats["final_rows"]
            if cleaning_stats.get("final_columns") is not None:
                profile["column_count"] = cleaning_stats["final_columns"]

            # Update dataset record
            dataset.status = DatasetStatus.CLEANED
            dataset.cleaned_at = datetime.utcnow()
            dataset.file_path = cleaned_path
            dataset.file_type = "parquet"
            dataset.row_count = cleaned_row_count
            dataset.column_count = cleaned_col_count
            dataset.profile_data = profile
            # Explicitly flag the JSON column as dirty so SQLAlchemy persists it
            flag_modified(dataset, "profile_data")

            db.commit()
        except Exception as e:
            dataset.status = DatasetStatus.FAILED
            profile = dict(dataset.profile_data or {})
            profile["cleaning_error"] = str(e)
            profile["cleaning_traceback"] = traceback.format_exc()
            dataset.profile_data = profile
            flag_modified(dataset, "profile_data")
            db.commit()
            print(f"Cleaning failed for dataset {dataset_id}: {e}")
            print(traceback.format_exc())
    finally:
        db.close()


@router.get("/{dataset_id}/clean/status")
async def get_cleaning_status(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return current cleaning status and stats if available."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    profile = dataset.profile_data or {}
    return {
        "dataset_id": dataset_id,
        "status": dataset.status,
        "cleaned_at": dataset.cleaned_at,
        "cleaning_stats": profile.get("cleaning_stats"),
        "cleaning_error": profile.get("cleaning_error"),
    }


@router.get("/{dataset_id}/download-cleaned")
async def download_cleaned_dataset(
    dataset_id: int,
    format: str = "parquet",  # parquet | csv | excel
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download the cleaned dataset in parquet, csv, or excel format."""
    from fastapi.responses import FileResponse, StreamingResponse
    import io

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    if dataset.status != DatasetStatus.CLEANED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset has not been cleaned yet.")

    file_path = Path(dataset.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cleaned file not found on disk.")

    stem = Path(dataset.original_filename).stem

    if format == "parquet":
        return FileResponse(
            path=file_path,
            filename=f"{stem}_cleaned.parquet",
            media_type="application/octet-stream",
        )
    elif format == "csv":
        df = pl.read_parquet(str(file_path))
        buf = io.BytesIO()
        df.write_csv(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{stem}_cleaned.csv"'},
        )
    elif format in ("excel", "xlsx"):
        df = pl.read_parquet(str(file_path))
        buf = io.BytesIO()
        df.write_excel(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{stem}_cleaned.xlsx"'},
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported format '{format}'. Use parquet, csv, or excel.")


@router.get("/{dataset_id}/ml-analysis")
async def get_ml_analysis(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return ML readiness, feature suggestions, target detection, and model recommendations."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    if dataset.status not in [DatasetStatus.PROFILED, DatasetStatus.CLEANED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset must be profiled first.")

    profile = dataset.profile_data or {}
    cleaning_stats = profile.get("cleaning_stats")

    # ML Readiness
    ml_readiness = calculate_ml_readiness(profile, cleaning_stats)

    # Feature Engineering Suggestions & Target Detection (use DuckDB — no full load)
    try:
        feature_suggestions = generate_feature_engineering_suggestions(
            dataset.file_path, dataset.file_type or "parquet"
        )
    except Exception as e:
        feature_suggestions = {"error": str(e)}

    try:
        target_columns = detect_target_columns(
            dataset.file_path, dataset.file_type or "parquet"
        )
    except Exception as e:
        target_columns = []

    # Model recommendations (use first detected target to infer type)
    target_type = "categorical"
    if target_columns:
        col_name = target_columns[0]
        data_types = profile.get("data_types") or {}
        col_dtype = (data_types.get(col_name) or "").upper()
        if any(t in col_dtype for t in ["INT", "DOUBLE", "FLOAT", "DECIMAL"]):
            target_type = "numeric"

    model_recommendations = recommend_ml_models(target_type, profile)

    return {
        "ml_readiness": ml_readiness,
        "feature_suggestions": feature_suggestions,
        "target_columns": target_columns,
        "model_recommendations": model_recommendations,
    }


@router.post("/{dataset_id}/prepare-ml")
async def prepare_ml(
    dataset_id: int,
    payload: MLPrepareOptions,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Automatically prepare a dataset for ML (clean + normalize + encode + split)."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    if dataset.status not in [DatasetStatus.PROFILED, DatasetStatus.CLEANED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset must be profiled before ML preparation.")

    background_tasks.add_task(
        prepare_ml_background, dataset_id, payload.model_dump()
    )
    return {"message": "ML preparation started", "dataset_id": dataset_id}


def prepare_ml_background(dataset_id: int, payload: dict):
    """Background task: clean + split dataset for ML."""
    import traceback
    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            return
        try:
            ml_dir = str(Path(settings.PROCESSED_DIR) / "ml_ready")
            stats = prepare_ml_dataset(
                dataset_path=dataset.file_path,
                target_column=payload.get("target_column"),
                test_size=payload.get("test_size", 0.2),
                normalize=payload.get("normalize", True),
                encode=payload.get("encode", True),
                output_dir=ml_dir,
            )
            profile = dict(dataset.profile_data or {})
            profile["ml_preparation"] = stats
            dataset.profile_data = profile
            db.commit()
        except Exception as e:
            profile = dict(dataset.profile_data or {})
            profile["ml_preparation_error"] = str(e)
            dataset.profile_data = profile
            db.commit()
            print(f"ML preparation failed for dataset {dataset_id}: {e}")
            print(traceback.format_exc())
    finally:
        db.close()


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a dataset."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Delete file from disk
    try:
        file_path = Path(dataset.file_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        print(f"Failed to delete file: {str(e)}")
    
    # Delete database record
    db.delete(dataset)
    db.commit()
    
    return None


@router.get("/{dataset_id}/download")
async def download_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download processed dataset."""
    from fastapi.responses import FileResponse
    
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    file_path = Path(dataset.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )
    
    return FileResponse(
        path=file_path,
        filename=dataset.original_filename,
        media_type="application/octet-stream"
    )


@router.post("/{dataset_id}/balance")
async def balance_dataset(
    dataset_id: int,
    target_column: str,
    method: str = "undersample",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Balance classes in dataset."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Create output path
    processed_dir = Path(settings.PROCESSED_DIR)
    output_path = processed_dir / f"balanced_{Path(dataset.file_path).name}"
    
    try:
        # Balance the dataset
        balance_stats = sampling_engine.balance_classes(
            input_path=dataset.file_path,
            output_path=str(output_path),
            target_column=target_column,
            method=method
        )
        
        return {
            "message": "Dataset balanced successfully",
            "stats": balance_stats,
            "output_path": str(output_path)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Balancing failed: {str(e)}"
        )


@router.get("/{dataset_id}/analyze-imbalance/{column}")
async def analyze_imbalance(
    dataset_id: int,
    column: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Analyze class imbalance in a specific column."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    try:
        analysis = sampling_engine.analyze_imbalance(dataset.file_path, column)
        return analysis
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/{dataset_id}/train-test-split")
async def create_train_test_split(
    dataset_id: int,
    test_size: float = 0.2,
    stratify_column: str = None,
    random_seed: int = 42,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create train/test split of the dataset."""
    if not 0 < test_size < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="test_size must be between 0 and 1"
        )
    
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    processed_dir = Path(settings.PROCESSED_DIR)
    train_path = processed_dir / f"train_{Path(dataset.file_path).name}"
    test_path = processed_dir / f"test_{Path(dataset.file_path).name}"
    
    try:
        # Create test set
        test_stats = sampling_engine.stratified_sample(
            input_path=dataset.file_path,
            output_path=str(test_path),
            sample_fraction=test_size,
            stratify_column=stratify_column
        )
        
        # Create train set (remaining data)
        train_fraction = 1 - test_size
        train_stats = sampling_engine.stratified_sample(
            input_path=dataset.file_path,
            output_path=str(train_path),
            sample_fraction=train_fraction,
            stratify_column=stratify_column
        )
        
        return {
            "message": "Train/test split created successfully",
            "train_path": str(train_path),
            "test_path": str(test_path),
            "train_stats": train_stats,
            "test_stats": test_stats,
            "split_ratio": f"{int((1-test_size)*100)}/{int(test_size*100)}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Split failed: {str(e)}"
        )
