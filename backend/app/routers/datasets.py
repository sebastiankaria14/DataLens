from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import aiofiles
import os
from pathlib import Path
from datetime import datetime

from ..core.database import get_db
from ..core.database import SessionLocal
from ..core.dependencies import get_current_active_user
from ..core.config import settings
from ..models.user import User
from ..models.dataset import Dataset, DatasetStatus
from ..schemas.dataset import DatasetResponse, DatasetProfile, CleaningOptions
from ..services.profiler import profiler
from ..services.cleaner import cleaner
from ..services.parquet_converter import parquet_converter
from ..services.sampling import sampling_engine

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

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
    
    return dataset.profile_data


@router.post("/{dataset_id}/clean")
async def clean_dataset(
    dataset_id: int,
    options: CleaningOptions,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Clean dataset with specified options."""
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.owner_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    
    # Schedule background cleaning
    background_tasks.add_task(clean_dataset_background, dataset_id, options.dict())
    
    return {"message": "Dataset cleaning started", "dataset_id": dataset_id}


def clean_dataset_background(dataset_id: int, options: dict):
    """Background task to clean dataset."""
    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            return

        try:
            dataset.status = DatasetStatus.CLEANING
            db.commit()

            # Create output path
            processed_dir = Path(settings.PROCESSED_DIR)
            processed_dir.mkdir(parents=True, exist_ok=True)

            output_filename = f"cleaned_{Path(dataset.file_path).name}"
            output_path = processed_dir / output_filename

            # Clean the dataset
            cleaning_stats = cleaner.clean_dataset(
                file_path=dataset.file_path,
                file_type=dataset.file_type,
                output_path=str(output_path),
                **options
            )

            # Update dataset
            dataset.status = DatasetStatus.CLEANED
            dataset.cleaned_at = datetime.utcnow()
            dataset.file_path = str(output_path)  # Update to cleaned file

            # Update profile data with cleaning stats
            if dataset.profile_data:
                dataset.profile_data["cleaning_stats"] = cleaning_stats

            db.commit()
        except Exception as e:
            dataset.status = DatasetStatus.FAILED
            if dataset.profile_data:
                dataset.profile_data["error"] = str(e)
            else:
                dataset.profile_data = {"error": str(e)}
            db.commit()
            print(f"Cleaning failed for dataset {dataset_id}: {str(e)}")
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
