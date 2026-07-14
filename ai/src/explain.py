import pickle
import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from config import MODEL_DIR, OUTPUT_DIR
from preprocess import preprocess


def load_model():
    """Load the trained XGBoost model from disk."""
    model_path = MODEL_DIR / "xgboost_model.pkl"
    with open(model_path, "rb") as f:
        model = pickle.load(f)
    print(f"Model loaded from {model_path}")
    return model


def compute_shap_values(model, X_data):
    """Compute SHAP values using TreeExplainer for the XGBoost model."""
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_data)
    return explainer, shap_values


def plot_shap_summary(shap_values, X_data):
    """Generate and save a SHAP summary bar plot showing feature importance."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(shap_values, X_data, plot_type="bar", show=False)
    plt.title("SHAP Feature Importance (Mean |SHAP Value|)", fontsize=14)
    plt.tight_layout()

    save_path = OUTPUT_DIR / "shap_summary.png"
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close("all")
    print(f"SHAP summary plot saved to {save_path}")


def get_feature_importance(shap_values, feature_names):
    """Return a DataFrame of features ranked by mean absolute SHAP value."""
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    importance_df = pd.DataFrame({
        "feature": feature_names,
        "mean_abs_shap": mean_abs_shap,
    })
    importance_df = importance_df.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    return importance_df


def explain_single_prediction(model, X_single, feature_names):
    """
    Generate SHAP explanation for a single applicant's prediction.

    Args:
        model: Trained XGBoost model.
        X_single: A single row DataFrame or 2D array of feature values.
        feature_names: List of feature column names.

    Returns:
        dict with prediction, probability, and per-feature SHAP contributions.
    """
    explainer = shap.TreeExplainer(model)

    if isinstance(X_single, pd.Series):
        X_single = X_single.to_frame().T

    shap_values = explainer.shap_values(X_single)
    prediction = model.predict(X_single)[0]
    probability = model.predict_proba(X_single)[0]

    contributions = []
    for i, name in enumerate(feature_names):
        contributions.append({
            "feature": name,
            "value": float(X_single.iloc[0, i]) if isinstance(X_single, pd.DataFrame) else float(X_single[0, i]),
            "shap_value": float(shap_values[0, i]),
            "impact": "positive" if shap_values[0, i] > 0 else "negative",
        })

    # Sort by absolute impact
    contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    return {
        "prediction": int(prediction),
        "prediction_label": "Approved" if prediction == 1 else "Rejected",
        "probability_approved": float(probability[1]),
        "probability_rejected": float(probability[0]),
        "base_value": float(explainer.expected_value),
        "top_factors": contributions[:10],
        "all_factors": contributions,
    }


def explain():
    """Run the full explainability pipeline on the test set."""
    # Load preprocessed data
    X_train, X_val, X_test, y_train, y_val, y_test = preprocess()

    # Load trained model
    model = load_model()

    # Compute SHAP values on test set
    print("Computing SHAP values (this may take a moment)...")
    explainer, shap_values = compute_shap_values(model, X_test)

    # Generate summary plot
    plot_shap_summary(shap_values, X_test)

    # Display feature importance ranking
    feature_names = list(X_test.columns)
    importance_df = get_feature_importance(shap_values, feature_names)
    print("\n--- Feature Importance (by SHAP) ---")
    print(importance_df.to_string(index=False))

    # Example: explain first test sample
    print("\n--- Sample Explanation (first test row) ---")
    explanation = explain_single_prediction(model, X_test.iloc[[0]], feature_names)
    print(f"  Prediction: {explanation['prediction_label']}")
    print(f"  P(Approved): {explanation['probability_approved']:.4f}")
    print(f"  Top factors:")
    for factor in explanation["top_factors"][:5]:
        direction = "↑" if factor["impact"] == "positive" else "↓"
        print(f"    {direction} {factor['feature']}: SHAP = {factor['shap_value']:+.4f}")

    print("\nExplainability analysis complete.")
    return importance_df


if __name__ == "__main__":
    explain()
