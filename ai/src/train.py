from preprocess import preprocess
from xgboost import XGBClassifier
import pickle
from config import MODEL_DIR


def load_processed_data():
    X_train, X_val, X_test, y_train, y_val, y_test = preprocess()
    return X_train, X_val, X_test, y_train, y_val, y_test


def create_model():
    model = XGBClassifier(random_state=42, n_estimators=100, learning_rate=0.1)
    return model


def train_model(model, X_train, y_train):
    model.fit(X_train, y_train)
    return model


def save_model(model):
    with open(MODEL_DIR / "xgboost_model.pkl", "wb") as f:
        pickle.dump(model, f)


def train():
    X_train, X_val, X_test, y_train, y_val, y_test = load_processed_data()
    
    model = create_model()
    model = train_model(model, X_train, y_train)
    
    y_val_pred = model.predict(X_val)
    accuracy = (y_val_pred == y_val).mean()
    print(f"Validation Accuracy: {accuracy:.4f}")
    
    save_model(model)
    print("Model saved to models/xgboost_model.pkl")


if __name__ == "__main__":
    train()
