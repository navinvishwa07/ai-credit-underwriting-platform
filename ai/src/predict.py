import sys
import json
import pickle
import numpy as np
import pandas as pd

from config import MODEL_DIR
from feature_whitelist import FEATURE_COLUMNS, CATEGORICAL_COLUMNS, NUMERICAL_COLUMNS
from explain import explain_single_prediction


def load_model():
    """Load the trained XGBoost model from disk."""
    model_path = MODEL_DIR / "xgboost_model.pkl"
    with open(model_path, "rb") as f:
        model = pickle.load(f)
    return model


def load_encoders():
    """Load the label encoders used during preprocessing."""
    encoder_path = MODEL_DIR / "label_encoders.pkl"
    with open(encoder_path, "rb") as f:
        encoders = pickle.load(f)
    return encoders


def load_feature_columns():
    """Load the feature column order used during training."""
    feature_path = MODEL_DIR / "feature_columns.pkl"
    with open(feature_path, "rb") as f:
        columns = pickle.load(f)
    return columns


def prepare_input(applicant_data, encoders):
    """
    Transform raw applicant data dict into a model-ready DataFrame.

    Args:
        applicant_data: dict with keys matching FEATURE_COLUMNS.
        encoders: dict of LabelEncoders fitted during preprocessing.

    Returns:
        DataFrame with a single row ready for model prediction.
    """
    # Build a single-row DataFrame from the input
    row = {}
    for col in FEATURE_COLUMNS:
        row[col] = applicant_data.get(col, None)

    df = pd.DataFrame([row])

    # Fill missing numerical values with 0
    for col in NUMERICAL_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Encode categorical values
    for col in CATEGORICAL_COLUMNS:
        if col in df.columns and col in encoders:
            encoder = encoders[col]
            val = str(df[col].iloc[0])
            if val in encoder.classes_:
                df[col] = encoder.transform([val])[0]
            else:
                # Unseen category — use the most frequent class (index 0)
                df[col] = 0

    return df


def compute_risk_category(probability):
    """Map approval probability to a risk category."""
    if probability >= 0.75:
        return "Low Risk"
    elif probability >= 0.50:
        return "Medium Risk"
    elif probability >= 0.30:
        return "High Risk"
    else:
        return "Very High Risk"


def predict_single(applicant_data):
    """
    Run a full prediction for a single applicant.

    Args:
        applicant_data: dict with applicant feature values.

    Returns:
        dict containing prediction, probability, risk category,
        recommendation, and SHAP-based explanation.
    """
    model = load_model()
    encoders = load_encoders()

    # Prepare input
    X = prepare_input(applicant_data, encoders)
    feature_names = list(X.columns)

    # Predict
    prediction = model.predict(X)[0]
    probability = model.predict_proba(X)[0]

    # Risk assessment
    prob_approved = float(probability[1])
    risk_category = compute_risk_category(prob_approved)

    if prediction == 1 and prob_approved >= 0.70:
        recommendation = "Approve"
    elif prediction == 1 and prob_approved >= 0.50:
        recommendation = "Conditional Approve"
    elif prediction == 0 and prob_approved >= 0.40:
        recommendation = "Manual Review"
    else:
        recommendation = "Reject"

    # SHAP explanation
    explanation = explain_single_prediction(model, X, feature_names)

    # Build result
    result = {
        "prediction": int(prediction),
        "prediction_label": "Approved" if prediction == 1 else "Rejected",
        "probability_approved": round(prob_approved, 4),
        "probability_rejected": round(float(probability[0]), 4),
        "overall_score": round(prob_approved * 100, 2),
        "risk_category": risk_category,
        "recommendation": recommendation,
        "top_factors": explanation["top_factors"],
    }

    return result


def predict_from_cli():
    """
    Read applicant JSON from stdin and output prediction JSON to stdout.
    This is used by the Node.js backend to call the Python model.
    """
    try:
        input_data = json.loads(sys.stdin.read())
        result = predict_single(input_data)
        print(json.dumps(result))
    except Exception as e:
        error_response = {
            "error": True,
            "message": str(e),
        }
        print(json.dumps(error_response))
        sys.exit(1)


if __name__ == "__main__":
    # If data is piped via stdin, use CLI mode
    if not sys.stdin.isatty():
        predict_from_cli()
    else:
        # Demo mode with sample data
        sample = {
            "age": 30,
            "gender": "Male",
            "marital_status": "Single",
            "number_of_dependents": 0,
            "education_level": "Postgraduate",
            "employment_type": "Full-Time",
            "occupation": "Salaried Employee",
            "income_type": "Salary",
            "state": "Karnataka",
            "area_type": "Urban",
            "monthly_income": 75000,
            "loan_type": "Personal Loan",
            "loan_amount_requested": 500000,
            "loan_tenure_months": 36,
            "loan_purpose": "Debt Consolidation",
            "credit_score": 750,
            "existing_emi": 5000,
            "savings_balance": 200000,
            "total_assets_value": 1500000,
            "liquid_assets_value": 300000,
            "loan_to_income_ratio": 6.67,
            "debt_to_income_ratio": 0.07,
        }

        print("--- Sample Prediction ---")
        result = predict_single(sample)
        print(json.dumps(result, indent=2))
