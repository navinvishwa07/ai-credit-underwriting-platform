from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATASET_DIR = BASE_DIR / "datasets"
MODEL_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "outputs"

RAW_DATASET = DATASET_DIR / "master_dataset.csv"
TRAIN_DATASET = DATASET_DIR / "master_dataset_train.csv"
VAL_DATASET = DATASET_DIR / "master_dataset_val.csv"
TEST_DATASET = DATASET_DIR / "master_dataset_test.csv"

TARGET_COLUMN = "loan_status"

RANDOM_STATE = 42
TEST_SIZE = 0.15
VALIDATION_SIZE = 0.15