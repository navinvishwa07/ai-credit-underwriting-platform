import pandas as pd
import pickle
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from config import *
from feature_whitelist import FEATURE_COLUMNS, CATEGORICAL_COLUMNS, NUMERICAL_COLUMNS


def load_dataset():
    return pd.read_csv(RAW_DATASET)


def select_features(df):
    return df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()


def handle_missing_values(df):
    print("Missing values per column:")
    print(df.isnull().sum())
    
    for col in NUMERICAL_COLUMNS:
        if col in df.columns:
            df[col].fillna(df[col].median(), inplace=True)
    
    for col in CATEGORICAL_COLUMNS:
        if col in df.columns:
            df[col].fillna(df[col].mode()[0], inplace=True)
    
    return df


def encode_categorical_features(df):
    encoders = {}
    
    for col in CATEGORICAL_COLUMNS:
        if col in df.columns:
            encoder = LabelEncoder()
            df[col] = encoder.fit_transform(df[col].astype(str))
            encoders[col] = encoder
    
    return df, encoders


def split_dataset(df):
    X = df.drop(TARGET_COLUMN, axis=1)
    y = df[TARGET_COLUMN]
    
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    
    val_size_adjusted = VALIDATION_SIZE / (1 - TEST_SIZE)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_size_adjusted, random_state=RANDOM_STATE
    )
    
    return X_train, X_val, X_test, y_train, y_val, y_test


def save_encoders(encoders):
    with open(MODEL_DIR / "label_encoders.pkl", "wb") as f:
        pickle.dump(encoders, f)


def preprocess():
    df = load_dataset()
    df = select_features(df)
    df = handle_missing_values(df)
    df, encoders = encode_categorical_features(df)
    X_train, X_val, X_test, y_train, y_val, y_test = split_dataset(df)
    save_encoders(encoders)
    
    return X_train, X_val, X_test, y_train, y_val, y_test


if __name__ == "__main__":
    df = load_dataset()

    print("Original Shape:", df.shape)

    df = select_features(df)

    print("Selected Shape:", df.shape)

    print(df.head())