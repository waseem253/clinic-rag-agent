"""End-to-end agent test: real clinical questions, full LangGraph run."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from clinic_rag.agent import ask

QUESTIONS = [
    "What is the first-line treatment for uncomplicated gonorrhea in adults?",
    "At what age should average-risk adults start colorectal cancer screening, and what tests are recommended?",
    "What does CDC recommend about initial opioid prescribing for acute pain?",
    "Whats the weather today?",  # out_of_scope
]


def main() -> None:
    for q in QUESTIONS:
        print("=" * 80)
        print(f"Q: {q}")
        print("-" * 80)
        result = ask(q)
        print(f"[triage: {result.get('triage')}, grade: {result.get('grade')}, "
              f"retries: {result.get('retries', 0)}, hits: {len(result.get('hits') or [])}]")
        print()
        print(result["answer"])
        if result.get("citations"):
            print("\nCitations:")
            for c in result["citations"]:
                print(f"  {c}")
        print()


if __name__ == "__main__":
    main()
