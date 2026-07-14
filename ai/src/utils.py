import os
import pickle
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd
import numpy as np

from config import MODEL_DIR, OUTPUT_DIR, DATASET_DIR


# ──────────────────────────────────────────────
#  Logging
# ──────────────────────────────────────────────

def setup_logger(name="rupya_ai", log_file=None, level=logging.INFO):
    """
    Create and configure a logger with console and optional file output.

    Args:
        name: Logger name.
        log_file: Path to log file. If None, logs to console only.
        level: Logging level.

    Returns:
        Configured logger instance.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid duplicate handlers
    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler (optional)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


# ──────────────────────────────────────────────
#  Model I/O
# ──────────────────────────────────────────────

def save_pickle(obj, filepath):
    """Save a Python object to a pickle file."""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "wb") as f:
        pickle.dump(obj, f)


def load_pickle(filepath):
    """Load a Python object from a pickle file."""
    with open(filepath, "rb") as f:
        return pickle.load(f)


# ──────────────────────────────────────────────
#  Data Utilities
# ──────────────────────────────────────────────

def load_csv(filepath, **kwargs):
    """Load a CSV file into a pandas DataFrame with error handling."""
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Dataset not found: {filepath}")
    return pd.read_csv(filepath, **kwargs)


def save_csv(df, filepath, index=False, **kwargs):
    """Save a DataFrame to a CSV file, creating directories as needed."""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(filepath, index=index, **kwargs)


def print_dataset_summary(df, name="Dataset"):
    """Print a concise summary of a DataFrame for quick inspection."""
    print(f"\n{'=' * 50}")
    print(f"  {name} Summary")
    print(f"{'=' * 50}")
    print(f"  Shape       : {df.shape[0]} rows × {df.shape[1]} columns")
    print(f"  Memory      : {df.memory_usage(deep=True).sum() / 1024:.1f} KB")
    print(f"  Missing     : {df.isnull().sum().sum()} total null values")
    print(f"  Duplicates  : {df.duplicated().sum()} duplicate rows")

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    cat_cols = df.select_dtypes(include=["object", "category"]).columns
    print(f"  Numerical   : {len(numeric_cols)} columns")
    print(f"  Categorical : {len(cat_cols)} columns")
    print(f"{'=' * 50}\n")


# ──────────────────────────────────────────────
#  Formatting / Display
# ──────────────────────────────────────────────

def format_currency(amount, currency="₹"):
    """Format a number as Indian currency."""
    if amount is None:
        return "—"
    try:
        amount = float(amount)
        if amount >= 10000000:
            return f"{currency}{amount / 10000000:.2f} Cr"
        elif amount >= 100000:
            return f"{currency}{amount / 100000:.2f} L"
        else:
            return f"{currency}{amount:,.0f}"
    except (ValueError, TypeError):
        return "—"


def format_percentage(value, decimals=2):
    """Format a decimal value as a percentage string."""
    if value is None:
        return "—"
    try:
        return f"{float(value) * 100:.{decimals}f}%"
    except (ValueError, TypeError):
        return "—"


def risk_color(risk_category):
    """Return a hex color code for a risk category (for UI display)."""
    colors = {
        "Low Risk": "#22c55e",
        "Medium Risk": "#f59e0b",
        "High Risk": "#f97316",
        "Very High Risk": "#ef4444",
    }
    return colors.get(risk_category, "#6b7280")


# ──────────────────────────────────────────────
#  Directory & Environment Helpers
# ──────────────────────────────────────────────

def ensure_directories():
    """Create required project directories if they don't exist."""
    for dir_path in [MODEL_DIR, OUTPUT_DIR, DATASET_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)


def get_timestamp():
    """Return a formatted timestamp string for filenames and logs."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")
