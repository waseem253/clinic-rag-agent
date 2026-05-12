"""
Day 2 smoke test: 10 representative clinical queries against the corpus.

Goal: prove hybrid retrieval surfaces the right doc + section for each query
before we wire it into the LangGraph agent on Day 3.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from clinic_rag.retrieval import hybrid_search

QUERIES = [
    # Vaccines (ACIP)
    "At what age should adults get the shingles vaccine?",
    "How many doses of MMR are recommended for adults born after 1957?",
    # STI treatment (CDC 2021)
    "What is the first-line treatment for uncomplicated gonorrhea?",
    "How should syphilis be treated in a penicillin-allergic patient?",
    # Cholesterol (NHLBI ATP III)
    "What LDL goal does ATP III set for patients with established coronary heart disease?",
    # Cancer screening (USPSTF colorectal)
    "At what age should average-risk adults start colorectal cancer screening?",
    # Opioid prescribing (CDC 2022)
    "What does CDC recommend about initial opioid therapy duration for acute pain?",
    # TB treatment
    "What is the standard regimen for drug-susceptible pulmonary tuberculosis?",
    # Hypertension stats
    "What percentage of US adults have hypertension?",
    # Cross-doc / harder
    "How should I counsel a 50-year-old patient with high cholesterol and hypertension?",
]


def main() -> None:
    print(f"\n{'='*80}\nHybrid retrieval smoke test ({len(QUERIES)} queries)\n{'='*80}\n")
    for i, q in enumerate(QUERIES, 1):
        print(f"[{i:2d}] {q}")
        hits = hybrid_search(q, top_n=3, rerank=True)
        if not hits:
            print("     !! NO RESULTS")
            continue
        for j, h in enumerate(hits, 1):
            snippet = " ".join(h.text.split())[:140]
            print(f"     #{j} score={h.score:.3f}  {h.cite()}")
            print(f"        {snippet}...")
        print()


if __name__ == "__main__":
    main()
