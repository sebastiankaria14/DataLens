from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class DatasetStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROFILING = "profiling"
    PROFILED = "profiled"
    CLEANING = "cleaning"
    CLEANED = "cleaned"
    FAILED = "failed"


class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # csv, excel, json
    file_size = Column(Integer)  # in bytes
    status = Column(Enum(DatasetStatus), default=DatasetStatus.UPLOADED)
    
    # Profiling results
    row_count = Column(Integer)
    column_count = Column(Integer)
    profile_data = Column(JSON)  # Detailed profiling statistics
    
    # User relationship
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="datasets")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    profiled_at = Column(DateTime, nullable=True)
    cleaned_at = Column(DateTime, nullable=True)
