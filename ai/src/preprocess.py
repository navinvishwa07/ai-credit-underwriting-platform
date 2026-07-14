import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from config import *
from feature_whitelist import FEATURE_COLUMNS, CATEGORICAL_COLUMNS, NUMERICAL_COLUMNS


def load_dataset():
    return pd.read_csv(RAW_DATASET)


def select_features(df):
    return df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()

if __name__ == "__main__":
    df = load_dataset()

    print("Original Shape:", df.shape)

    df = select_features(df)

    print("Selected Shape:", df.shape)

    print(df.head())