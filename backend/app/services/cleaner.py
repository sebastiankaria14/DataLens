import polars as pl
import duckdb
import math
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path


# ---------------------------------------------------------------------------
# Standalone functional helpers (Phases 1-2)
# Each returns (new_df, stats_dict) and never mutates the input frame.
# ---------------------------------------------------------------------------

def remove_duplicates(df: pl.DataFrame) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Remove duplicate rows. Returns (cleaned_df, stats)."""
    before = len(df)
    cleaned = df.unique()
    return cleaned, {"rows_removed": before - len(cleaned)}


def handle_missing_values(
    df: pl.DataFrame, strategy_map: Dict[str, str]
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Handle missing values per column strategy.

    strategy_map: {column_name: strategy} where strategy is one of:
        'drop', 'fill_mean', 'fill_median', 'fill_mode', 'fill_zero', 'fill_empty'
    A special key '__all__' applies the same strategy to every column.
    """
    stats: Dict[str, Any] = {"columns_handled": [], "rows_dropped": 0}
    out = df

    # Expand '__all__' shorthand
    if "__all__" in strategy_map:
        default = strategy_map["__all__"]
        strategy_map = {col: default for col in df.columns}

    drop_cols = [c for c, s in strategy_map.items() if s == "drop"]
    if drop_cols:
        before = len(out)
        out = out.drop_nulls(subset=drop_cols)
        stats["rows_dropped"] = before - len(out)
        stats["columns_handled"].extend(drop_cols)

    numeric_dtypes = (pl.Int8, pl.Int16, pl.Int32, pl.Int64,
                      pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
                      pl.Float32, pl.Float64)

    for col, strategy in strategy_map.items():
        if col not in out.columns or strategy == "drop":
            continue
        series = out[col]
        if series.null_count() == 0:
            continue
        fill_expr = None
        if strategy == "fill_mean" and series.dtype in numeric_dtypes:
            mean_val = series.mean()
            if mean_val is not None:
                fill_expr = pl.col(col).fill_null(mean_val)
        elif strategy == "fill_median" and series.dtype in numeric_dtypes:
            median_val = series.median()
            if median_val is not None:
                fill_expr = pl.col(col).fill_null(median_val)
        elif strategy == "fill_mode":
            mode_series = series.drop_nulls().mode()
            if len(mode_series) > 0:
                fill_expr = pl.col(col).fill_null(mode_series[0])
        elif strategy == "fill_zero" and series.dtype in numeric_dtypes:
            fill_expr = pl.col(col).fill_null(0)
        elif strategy == "fill_empty":
            fill_expr = pl.col(col).fill_null("")
        if fill_expr is not None:
            out = out.with_columns(fill_expr)
            stats["columns_handled"].append(col)

    return out, stats


def convert_column_types(
    df: pl.DataFrame, type_map: Dict[str, str]
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Cast columns to target types. type_map: {col: polars_dtype_str}."""
    _type_lookup = {
        "int": pl.Int64, "int64": pl.Int64, "int32": pl.Int32, "int16": pl.Int16,
        "float": pl.Float64, "float64": pl.Float64, "float32": pl.Float32,
        "str": pl.Utf8, "string": pl.Utf8, "utf8": pl.Utf8,
        "bool": pl.Boolean, "boolean": pl.Boolean,
        "date": pl.Date, "datetime": pl.Datetime,
    }
    converted = []
    errors = []
    out = df
    for col, dtype_str in type_map.items():
        if col not in out.columns:
            errors.append(f"Column '{col}' not found")
            continue
        target = _type_lookup.get(dtype_str.lower())
        if target is None:
            errors.append(f"Unknown dtype '{dtype_str}' for column '{col}'")
            continue
        try:
            out = out.with_columns(pl.col(col).cast(target))
            converted.append(col)
        except Exception as e:
            errors.append(f"Failed to cast '{col}': {e}")
    return out, {"converted_columns": converted, "errors": errors}


def detect_outliers(df: pl.DataFrame) -> Dict[str, Any]:
    """Return per-column outlier counts using IQR (numeric only)."""
    numeric_dtypes = (pl.Int8, pl.Int16, pl.Int32, pl.Int64,
                      pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
                      pl.Float32, pl.Float64)
    result: Dict[str, Any] = {}
    for col in df.columns:
        if df[col].dtype not in numeric_dtypes:
            continue
        series = df[col].drop_nulls()
        if len(series) == 0:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        count = int(((series < lower) | (series > upper)).sum())
        result[col] = {
            "outlier_count": count,
            "lower_bound": float(lower),
            "upper_bound": float(upper),
            "q1": float(q1),
            "q3": float(q3),
        }
    return result


def handle_outliers(
    df: pl.DataFrame, method: str = "iqr", action: str = "remove"
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Handle outliers. action: 'remove' | 'cap'.
    method: 'iqr' | 'zscore'
    """
    numeric_dtypes = (pl.Int8, pl.Int16, pl.Int32, pl.Int64,
                      pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
                      pl.Float32, pl.Float64)
    initial = len(df)
    out = df
    affected_cols = []

    for col in out.columns:
        if out[col].dtype not in numeric_dtypes:
            continue
        series = out[col].drop_nulls()
        if len(series) == 0:
            continue

        if method == "iqr":
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
        else:  # zscore
            mean = series.mean()
            std = series.std()
            if std == 0 or std is None:
                continue
            lower = mean - 3 * std
            upper = mean + 3 * std

        if action == "cap":
            out = out.with_columns([
                pl.col(col).clip(lower_bound=lower, upper_bound=upper)
            ])
        else:  # remove (filter using mask on non-null values)
            mask = (pl.col(col).is_null()) | ((pl.col(col) >= lower) & (pl.col(col) <= upper))
            out = out.filter(mask)

        affected_cols.append(col)

    return out, {
        "rows_removed": initial - len(out) if action == "remove" else 0,
        "columns_affected": affected_cols,
        "method": method,
        "action": action,
    }


def normalize_numeric_columns(df: pl.DataFrame) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Min-max normalize all numeric columns to [0, 1]."""
    numeric_dtypes = (pl.Int8, pl.Int16, pl.Int32, pl.Int64,
                      pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
                      pl.Float32, pl.Float64)
    normalized = []
    out = df
    for col in out.columns:
        if out[col].dtype not in numeric_dtypes:
            continue
        mn = out[col].min()
        mx = out[col].max()
        if mn is None or mx is None or mx == mn:
            continue
        out = out.with_columns(
            ((pl.col(col).cast(pl.Float64) - mn) / (mx - mn)).alias(col)
        )
        normalized.append(col)
    return out, {"normalized_columns": normalized}


def encode_categorical_columns(df: pl.DataFrame) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Label-encode categorical (Utf8) columns to integer codes."""
    encoded = []
    out = df
    for col in out.columns:
        if out[col].dtype != pl.Utf8:
            continue
        # Only encode low-cardinality columns (avoids encoding free-text)
        unique_count = out[col].n_unique()
        if unique_count > 50:
            continue
        out = out.with_columns(
            out[col].cast(pl.Categorical).to_physical().alias(col)
        )
        encoded.append(col)
    return out, {"encoded_columns": encoded}


def balance_classes(
    df: pl.DataFrame, target_column: str, method: str = "undersample"
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Balance class distribution in target_column.
    method: 'undersample' | 'oversample'
    """
    if target_column not in df.columns:
        return df, {"error": f"Column '{target_column}' not found"}

    counts = (
        df.group_by(target_column)
        .agg(pl.len().alias("n"))
        .sort("n")
    )
    min_count = int(counts["n"].min())
    max_count = int(counts["n"].max())
    class_list = counts[target_column].to_list()

    frames = []
    if method == "undersample":
        for cls in class_list:
            subset = df.filter(pl.col(target_column) == cls)
            frames.append(subset.sample(n=min_count, shuffle=True, seed=42))
    else:  # oversample
        for cls in class_list:
            subset = df.filter(pl.col(target_column) == cls)
            n = len(subset)
            copies = max_count // n
            remainder = max_count % n
            repeated = pl.concat([subset] * copies + [subset.head(remainder)])
            frames.append(repeated)

    balanced = pl.concat(frames).sample(fraction=1.0, shuffle=True, seed=42)
    return balanced, {
        "original_rows": len(df),
        "balanced_rows": len(balanced),
        "method": method,
        "min_class_count": min_count,
        "max_class_count": max_count,
    }


# ---------------------------------------------------------------------------
# Phase 2: Pipeline
# ---------------------------------------------------------------------------

def clean_dataset_pipeline(
    dataset_path: str,
    options: Dict[str, Any],
    output_dir: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """Full cleaning pipeline operating on a Parquet file.

    options keys (all optional / with defaults):
        remove_duplicates   bool   (False)
        handle_missing      str|None  '__all__' strategy, or None
        missing_strategy_map dict  per-column strategy override
        convert_types       dict  {col: dtype_str}
        remove_outliers     bool   (False)
        outlier_method      str   'iqr' | 'zscore'
        outlier_action      str   'remove' | 'cap'
        normalize           bool   (False)
        encode_categoricals bool   (False)
        balance_target      str|None  target column for balancing
        balance_method      str   'undersample' | 'oversample'
        filter_columns      list|None  columns to keep

    Returns (cleaned_path, stats_dict).
    """
    path = Path(dataset_path)
    # Load lazily then collect (supports large files up to available RAM; truly
    # large datasets would need chunked processing, but Polars lazy should be fine)
    lf = pl.scan_parquet(str(path))
    df = lf.collect()

    all_stats: Dict[str, Any] = {
        "initial_rows": len(df),
        "initial_columns": len(df.columns),
        "operations_performed": [],
    }

    # 1. Filter columns
    filter_cols = options.get("filter_columns")
    if filter_cols:
        valid = [c for c in filter_cols if c in df.columns]
        df = df.select(valid)
        all_stats["operations_performed"].append({"operation": "filter_columns", "kept": valid})

    # 2. Remove duplicates
    if options.get("remove_duplicates", False):
        df, s = remove_duplicates(df)
        all_stats["operations_performed"].append({"operation": "remove_duplicates", **s})

    # 3. Handle missing values
    strat_map = options.get("missing_strategy_map") or {}
    global_missing = options.get("handle_missing")
    if global_missing and not strat_map:
        strat_map = {"__all__": global_missing}
    if strat_map:
        df, s = handle_missing_values(df, strat_map)
        all_stats["operations_performed"].append({"operation": "handle_missing", **s})

    # 4. Convert column types
    type_map = options.get("convert_types") or {}
    if type_map:
        df, s = convert_column_types(df, type_map)
        all_stats["operations_performed"].append({"operation": "convert_types", **s})

    # 5. Detect outliers (just record, don't remove yet)
    outlier_info = detect_outliers(df)
    all_stats["outlier_detection"] = outlier_info

    # 6. Handle outliers
    if options.get("remove_outliers", False):
        method = options.get("outlier_method", "iqr")
        action = options.get("outlier_action", "remove")
        df, s = handle_outliers(df, method=method, action=action)
        all_stats["operations_performed"].append({"operation": f"handle_outliers_{method}_{action}", **s})

    # 7. Normalize
    if options.get("normalize", False):
        df, s = normalize_numeric_columns(df)
        all_stats["operations_performed"].append({"operation": "normalize", **s})

    # 8. Encode categoricals
    if options.get("encode_categoricals", False):
        df, s = encode_categorical_columns(df)
        all_stats["operations_performed"].append({"operation": "encode_categoricals", **s})

    # 9. Balance classes
    balance_target = options.get("balance_target")
    if balance_target:
        method = options.get("balance_method", "undersample")
        df, s = balance_classes(df, balance_target, method)
        all_stats["operations_performed"].append({"operation": "balance_classes", **s})

    # 10. Validate
    all_stats["final_rows"] = len(df)
    all_stats["final_columns"] = len(df.columns)
    all_stats["rows_removed"] = all_stats["initial_rows"] - all_stats["final_rows"]
    all_stats["null_counts_after"] = {col: int(df[col].null_count()) for col in df.columns}

    # Save
    if output_dir is None:
        output_dir = str(path.parent.parent / "cleaned")
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"cleaned_{path.name}"
    df.write_parquet(str(out_path), compression="snappy", statistics=True)

    return str(out_path), all_stats


# ---------------------------------------------------------------------------
# Phase 3: ML Readiness
# ---------------------------------------------------------------------------

def calculate_ml_readiness(
    profile_data: Dict[str, Any],
    cleaning_stats: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Compute ML readiness score (0-100) and return recommendations."""
    row_count = profile_data.get("row_count", 0) or 0
    column_count = profile_data.get("column_count", 0) or 0
    duplicates = profile_data.get("duplicates", 0) or 0
    missing_values = profile_data.get("missing_values") or {}
    columns_info = profile_data.get("columns") or {}
    imbalance_warnings = profile_data.get("imbalance_warnings") or []
    quality_score = profile_data.get("quality_score") or 0

    # --- weights ---
    missing_weight = 25
    duplicates_weight = 15
    consistency_weight = 15
    imbalance_weight = 20
    variance_weight = 15
    outliers_weight = 10

    # Missing values penalty (0 = no missing → full score)
    total_cells = row_count * max(column_count, 1)
    total_missing = sum(missing_values.values()) if missing_values else 0
    missing_rate = total_missing / total_cells if total_cells else 0
    missing_score = max(0, missing_weight * (1 - missing_rate * 4))  # full penalty at 25% missing

    # Duplicate penalty
    dup_rate = duplicates / row_count if row_count else 0
    dup_score = max(0, duplicates_weight * (1 - dup_rate * 5))

    # Column consistency (penalize cols with > 50% missing)
    high_missing_cols = [c for c, v in missing_values.items() if row_count and (v / row_count) > 0.5]
    consistency_score = consistency_weight * max(0, 1 - len(high_missing_cols) / max(column_count, 1))

    # Imbalance
    severe = sum(1 for w in imbalance_warnings if w.get("severity") == "SEVERE")
    mild = sum(1 for w in imbalance_warnings if w.get("severity") == "WARNING")
    imbalance_score = max(0, imbalance_weight - severe * 10 - mild * 3)

    # Variance (penalize low-variance numeric columns)
    low_var_cols = []
    for col, info in columns_info.items():
        std = info.get("std")
        mean = info.get("mean")
        if std is not None and mean is not None and mean != 0:
            cv = abs(std / mean)
            if cv < 0.01:
                low_var_cols.append(col)
        elif std == 0:
            low_var_cols.append(col)
    variance_score = variance_weight * max(0, 1 - len(low_var_cols) / max(column_count, 1))

    # Outliers (from cleaning stats if available)
    outlier_cols = 0
    if cleaning_stats and "outlier_detection" in cleaning_stats:
        for col, od in cleaning_stats["outlier_detection"].items():
            if od.get("outlier_count", 0) / max(row_count, 1) > 0.05:
                outlier_cols += 1
    outlier_score = max(0, outliers_weight - outlier_cols * 2)

    ml_readiness = int(round(
        missing_score + dup_score + consistency_score + imbalance_score + variance_score + outlier_score
    ))
    ml_readiness = max(0, min(100, ml_readiness))

    # Issues and recommendations
    issues_remaining = []
    recommendations = []

    if missing_rate > 0.05:
        issues_remaining.append(f"High missing rate: {missing_rate*100:.1f}%")
        recommendations.append("Impute or drop columns with >50% missing values before training.")
    if dup_rate > 0.01:
        issues_remaining.append(f"Duplicate rows: {duplicates}")
        recommendations.append("Remove duplicate rows to prevent data leakage.")
    if high_missing_cols:
        issues_remaining.append(f"High-missing columns: {', '.join(high_missing_cols[:3])}")
        recommendations.append(f"Consider dropping columns with >50% nulls: {', '.join(high_missing_cols[:3])}")
    if severe > 0:
        issues_remaining.append("Severe class imbalance detected")
        recommendations.append("Apply SMOTE, oversampling, or class weights for imbalanced classes.")
    elif mild > 0:
        recommendations.append("Mild class imbalance; monitor F1/AUC instead of accuracy.")
    if low_var_cols:
        issues_remaining.append(f"Low-variance columns: {', '.join(low_var_cols[:3])}")
        recommendations.append(f"Consider dropping zero-variance columns: {', '.join(low_var_cols[:3])}")
    if outlier_cols > 0:
        recommendations.append("Cap or remove outliers in numeric columns before training.")
    if not issues_remaining:
        recommendations.append("Dataset looks clean and ready for modeling.")

    return {
        "dataset_quality_score": round(float(quality_score), 1),
        "ml_readiness_score": ml_readiness,
        "score_breakdown": {
            "missing_values": round(missing_score, 1),
            "duplicates": round(dup_score, 1),
            "column_consistency": round(consistency_score, 1),
            "class_imbalance": round(imbalance_score, 1),
            "feature_variance": round(variance_score, 1),
            "outliers": round(outlier_score, 1),
        },
        "issues_remaining": issues_remaining,
        "recommendations": recommendations,
        "low_variance_features": low_var_cols,
        "high_missing_columns": high_missing_cols,
        "severe_imbalance": severe > 0,
    }


# ---------------------------------------------------------------------------
# Phase 4: Feature Engineering Suggestions
# ---------------------------------------------------------------------------

def generate_feature_engineering_suggestions(
    dataset_path: str,
    file_type: str = "parquet",
) -> Dict[str, Any]:
    """Use DuckDB to generate feature engineering suggestions without full load."""
    from pathlib import Path as _Path

    norm_path = str(_Path(dataset_path).resolve()).replace("\\", "/")
    if file_type == "parquet":
        scan = f"read_parquet('{norm_path}')"
    elif file_type == "csv":
        scan = f"read_csv_auto('{norm_path}', header=true)"
    else:
        scan = f"read_json_auto('{norm_path}')"

    conn = duckdb.connect(":memory:")
    try:
        cols_info = conn.execute(f"DESCRIBE SELECT * FROM {scan}").fetchall()
        row_count = conn.execute(f"SELECT COUNT(*) FROM {scan}").fetchone()[0]

        drop_cols: List[str] = []
        normalize_cols: List[str] = []
        encode_cols: List[str] = []
        create_features: List[Dict[str, str]] = []
        correlated_pairs: List[Dict[str, Any]] = []

        id_keywords = ["id", "uuid", "customer_id", "user_id", "row_id", "index", "key"]
        numeric_types = ["INT", "DOUBLE", "FLOAT", "DECIMAL", "REAL", "BIGINT", "HUGEINT", "SMALLINT", "TINYINT"]
        string_types = ["VARCHAR", "CHAR", "TEXT", "STRING"]

        numeric_col_names: List[str] = []

        for col_name, col_type, *_ in cols_info:
            col_lower = col_name.lower()
            type_upper = col_type.upper()

            # Identifier columns → drop
            if any(kw == col_lower or col_lower.endswith(f"_{kw}") for kw in id_keywords):
                drop_cols.append(col_name)
                continue

            is_numeric = any(t in type_upper for t in numeric_types)
            is_string = any(t in type_upper for t in string_types)

            if is_numeric:
                numeric_col_names.append(col_name)
                # Check range for normalization suggestion
                try:
                    row = conn.execute(
                        f'SELECT MIN("{col_name}"), MAX("{col_name}") FROM {scan}'
                    ).fetchone()
                    if row and row[0] is not None and row[1] is not None:
                        col_range = float(row[1]) - float(row[0])
                        if col_range > 100:
                            normalize_cols.append(col_name)
                except Exception:
                    pass

            if is_string:
                try:
                    unique_count = conn.execute(
                        f'SELECT COUNT(DISTINCT "{col_name}") FROM {scan}'
                    ).fetchone()[0]
                    cardinality_ratio = unique_count / max(row_count, 1)
                    if cardinality_ratio > 0.9:
                        drop_cols.append(col_name)  # high cardinality → likely ID or free text
                        create_features.append({
                            "column": col_name,
                            "suggestion": "length_feature",
                            "description": f"Extract text length of '{col_name}' as a numeric feature",
                        })
                    elif unique_count <= 50:
                        encode_cols.append(col_name)
                    else:
                        create_features.append({
                            "column": col_name,
                            "suggestion": "hash_encoding",
                            "description": f"Apply hash or target encoding to high-cardinality '{col_name}' ({unique_count} unique values)",
                        })
                except Exception:
                    pass

        # Correlation check among numeric columns (up to 20 columns)
        if len(numeric_col_names) >= 2:
            sample_cols = numeric_col_names[:20]
            try:
                for i in range(len(sample_cols)):
                    for j in range(i + 1, len(sample_cols)):
                        c1, c2 = sample_cols[i], sample_cols[j]
                        row = conn.execute(
                            f'SELECT CORR("{c1}", "{c2}") FROM {scan}'
                        ).fetchone()
                        if row and row[0] is not None:
                            corr = float(row[0])
                            if abs(corr) > 0.95:
                                correlated_pairs.append({
                                    "col1": c1, "col2": c2, "correlation": round(corr, 3),
                                    "suggestion": f"Consider dropping one of ('{c1}', '{c2}') — highly correlated ({corr:.2f})",
                                })
            except Exception:
                pass

        # Deduplicate
        drop_cols = list(dict.fromkeys(drop_cols))
        normalize_cols = [c for c in normalize_cols if c not in drop_cols]
        encode_cols = [c for c in encode_cols if c not in drop_cols]

        return {
            "drop_columns": drop_cols,
            "normalize_columns": normalize_cols,
            "encode_columns": encode_cols,
            "create_features": create_features,
            "correlated_pairs": correlated_pairs,
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Phase 5: Target Column Detection
# ---------------------------------------------------------------------------

def detect_target_columns(dataset_path: str, file_type: str = "parquet") -> List[str]:
    """Detect likely target columns using name heuristics and cardinality."""
    from pathlib import Path as _Path

    norm_path = str(_Path(dataset_path).resolve()).replace("\\", "/")
    if file_type == "parquet":
        scan = f"read_parquet('{norm_path}')"
    elif file_type == "csv":
        scan = f"read_csv_auto('{norm_path}', header=true)"
    else:
        scan = f"read_json_auto('{norm_path}')"

    target_keywords = [
        "target", "label", "class", "status", "outcome", "fraud", "churn",
        "survived", "default", "output", "y", "flag", "result", "category",
        "is_", "has_", "will_",
    ]

    conn = duckdb.connect(":memory:")
    try:
        cols_info = conn.execute(f"DESCRIBE SELECT * FROM {scan}").fetchall()
        row_count = conn.execute(f"SELECT COUNT(*) FROM {scan}").fetchone()[0]
        candidates: List[str] = []

        for col_name, col_type, *_ in cols_info:
            col_lower = col_name.lower()
            # Keyword match
            if any(col_lower == kw or col_lower.startswith(kw) or col_lower.endswith(kw)
                   for kw in target_keywords):
                candidates.append(col_name)
                continue
            # Low-cardinality categorical
            type_upper = col_type.upper()
            is_string = any(t in type_upper for t in ["VARCHAR", "CHAR", "TEXT", "STRING"])
            is_int = any(t in type_upper for t in ["INT", "BIGINT", "SMALLINT", "TINYINT"])
            if is_string or is_int:
                try:
                    unique_count = conn.execute(
                        f'SELECT COUNT(DISTINCT "{col_name}") FROM {scan}'
                    ).fetchone()[0]
                    if 2 <= unique_count < 20:
                        candidates.append(col_name)
                except Exception:
                    pass

        # Deduplicate while preserving order
        seen: set = set()
        unique_candidates: List[str] = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                unique_candidates.append(c)
        return unique_candidates[:10]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Phase 6: ML Model Recommendation
# ---------------------------------------------------------------------------

def recommend_ml_models(target_column_type: str) -> Dict[str, Any]:
    """Return model recommendations based on target type."""
    if target_column_type in ("categorical", "string", "classification", "bool", "boolean"):
        return {
            "task": "classification",
            "models": [
                {
                    "name": "Random Forest",
                    "library": "sklearn.ensemble.RandomForestClassifier",
                    "notes": "Good default; handles mixed types and non-linearity well.",
                },
                {
                    "name": "Logistic Regression",
                    "library": "sklearn.linear_model.LogisticRegression",
                    "notes": "Fast and interpretable; works well when features are scaled.",
                },
                {
                    "name": "Gradient Boosting",
                    "library": "sklearn.ensemble.GradientBoostingClassifier",
                    "notes": "Often best accuracy; slower to train.",
                },
                {
                    "name": "XGBoost Classifier",
                    "library": "xgboost.XGBClassifier",
                    "notes": "Industry-grade boosting; great performance on tabular data.",
                },
                {
                    "name": "LightGBM Classifier",
                    "library": "lightgbm.LGBMClassifier",
                    "notes": "Fast gradient boosting; efficient on large datasets.",
                },
            ],
        }
    else:
        return {
            "task": "regression",
            "models": [
                {
                    "name": "Linear Regression",
                    "library": "sklearn.linear_model.LinearRegression",
                    "notes": "Simple baseline; assumes linear relationship.",
                },
                {
                    "name": "Random Forest Regressor",
                    "library": "sklearn.ensemble.RandomForestRegressor",
                    "notes": "Non-linear; robust to outliers.",
                },
                {
                    "name": "Gradient Boosting Regressor",
                    "library": "sklearn.ensemble.GradientBoostingRegressor",
                    "notes": "Usually best accuracy for regression tasks.",
                },
                {
                    "name": "XGBoost Regressor",
                    "library": "xgboost.XGBRegressor",
                    "notes": "High-performance gradient boosting for regression.",
                },
            ],
        }


# ---------------------------------------------------------------------------
# Phase 7: ML Dataset Preparation (train/test split)
# ---------------------------------------------------------------------------

def prepare_ml_dataset(
    dataset_path: str,
    target_column: Optional[str] = None,
    test_size: float = 0.2,
    normalize: bool = True,
    encode: bool = True,
    output_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """Clean, normalize, encode, and split dataset into train/test parquet files."""
    path = Path(dataset_path)
    lf = pl.scan_parquet(str(path))
    df = lf.collect()

    stats: Dict[str, Any] = {"initial_rows": len(df), "initial_columns": len(df.columns)}

    # Normalize
    if normalize:
        cols_to_normalize = [c for c in df.columns if c != target_column]
        temp_df = df.select(cols_to_normalize)
        temp_df, norm_s = normalize_numeric_columns(temp_df)
        # Merge back target column if present
        if target_column and target_column in df.columns:
            temp_df = temp_df.with_columns(df[target_column])
        df = temp_df
        stats["normalized_columns"] = norm_s["normalized_columns"]

    # Encode categoricals (excluding target)
    if encode:
        cols_to_encode = [c for c in df.columns if c != target_column]
        temp_df = df.select(cols_to_encode)
        temp_df, enc_s = encode_categorical_columns(temp_df)
        if target_column and target_column in df.columns:
            temp_df = temp_df.with_columns(df[target_column])
        df = temp_df
        stats["encoded_columns"] = enc_s["encoded_columns"]

    # Shuffle and split
    df = df.sample(fraction=1.0, shuffle=True, seed=42)
    n_test = max(1, int(len(df) * test_size))
    test_df = df.head(n_test)
    train_df = df.tail(len(df) - n_test)

    # Save
    if output_dir is None:
        output_dir = str(path.parent.parent / "ml_ready")
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    stem = path.stem.replace("cleaned_", "")
    train_path = out_dir / f"train_{stem}.parquet"
    test_path = out_dir / f"test_{stem}.parquet"

    train_df.write_parquet(str(train_path), compression="snappy")
    test_df.write_parquet(str(test_path), compression="snappy")

    stats.update({
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "split_ratio": f"{int((1 - test_size) * 100)}/{int(test_size * 100)}",
        "train_path": str(train_path),
        "test_path": str(test_path),
        "target_column": target_column,
    })
    return stats


# ===========================================================================
# Legacy class wrapper — keeps backward compat with existing router calls
# ===========================================================================

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
