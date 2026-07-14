import pickle
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    confusion_matrix,
    classification_report,
)

from config import MODEL_DIR, OUTPUT_DIR
from preprocess import preprocess


def load_model():
    """Load the trained XGBoost model from disk."""
    model_path = MODEL_DIR / "xgboost_model.pkl"
    with open(model_path, "rb") as f:
        model = pickle.load(f)
    print(f"Model loaded from {model_path}")
    return model


def generate_predictions(model, X_test):
    """Generate class predictions and probability scores."""
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    return y_pred, y_prob


def compute_metrics(y_test, y_pred, y_prob):
    """Compute a dictionary of evaluation metrics."""
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, average="weighted", zero_division=0),
        "recall": recall_score(y_test, y_pred, average="weighted", zero_division=0),
        "f1_score": f1_score(y_test, y_pred, average="weighted", zero_division=0),
        "roc_auc": roc_auc_score(y_test, y_prob),
    }
    return metrics


def save_metrics(metrics, y_test, y_pred):
    """Save metrics and classification report to a text file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    metrics_path = OUTPUT_DIR / "metrics.txt"

    report = classification_report(y_test, y_pred, zero_division=0)

    with open(metrics_path, "w") as f:
        f.write("=" * 50 + "\n")
        f.write("  MODEL EVALUATION METRICS\n")
        f.write("=" * 50 + "\n\n")
        for name, value in metrics.items():
            f.write(f"{name:<15}: {value:.4f}\n")
        f.write("\n" + "-" * 50 + "\n")
        f.write("  CLASSIFICATION REPORT\n")
        f.write("-" * 50 + "\n\n")
        f.write(report)
        f.write("\n")

    print(f"Metrics saved to {metrics_path}")


def plot_confusion_matrix(y_test, y_pred):
    """Generate and save a confusion matrix heatmap."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    cm = confusion_matrix(y_test, y_pred)
    labels = ["Rejected (0)", "Approved (1)"]

    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=labels,
        yticklabels=labels,
        title="Confusion Matrix",
        ylabel="Actual Label",
        xlabel="Predicted Label",
    )

    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    # Annotate each cell with the count
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j, i, format(cm[i, j], "d"),
                ha="center", va="center",
                color="white" if cm[i, j] > thresh else "black",
                fontsize=14,
            )

    fig.tight_layout()
    save_path = OUTPUT_DIR / "confusion_matrix.png"
    fig.savefig(save_path, dpi=150)
    plt.close(fig)
    print(f"Confusion matrix saved to {save_path}")


def plot_roc_curve(y_test, y_prob):
    """Generate and save the ROC curve."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    fpr, tpr, _ = roc_curve(y_test, y_prob)
    auc_score = roc_auc_score(y_test, y_prob)

    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot(fpr, tpr, color="darkorange", lw=2, label=f"ROC Curve (AUC = {auc_score:.4f})")
    ax.plot([0, 1], [0, 1], color="navy", lw=1.5, linestyle="--", label="Random Classifier")
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("Receiver Operating Characteristic (ROC) Curve")
    ax.legend(loc="lower right")
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    save_path = OUTPUT_DIR / "roc_curve.png"
    fig.savefig(save_path, dpi=150)
    plt.close(fig)
    print(f"ROC curve saved to {save_path}")


def evaluate():
    """Run the full evaluation pipeline."""
    # Load preprocessed data
    X_train, X_val, X_test, y_train, y_val, y_test = preprocess()

    # Load trained model
    model = load_model()

    # Generate predictions on the test set
    y_pred, y_prob = generate_predictions(model, X_test)

    # Compute and display metrics
    metrics = compute_metrics(y_test, y_pred, y_prob)
    print("\n--- Evaluation Results ---")
    for name, value in metrics.items():
        print(f"  {name:<15}: {value:.4f}")

    # Save outputs
    save_metrics(metrics, y_test, y_pred)
    plot_confusion_matrix(y_test, y_pred)
    plot_roc_curve(y_test, y_prob)

    print("\nEvaluation complete. All outputs saved to:", OUTPUT_DIR)
    return metrics


if __name__ == "__main__":
    evaluate()
