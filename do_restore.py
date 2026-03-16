import subprocess, os
files = [
    "packages/engine/src/__tests__/analyzers/context-quality.test.ts",
    "packages/engine/src/__tests__/analyzers/dev-environment.test.ts",
    "packages/engine/src/__tests__/analyzers/doc-readability.test.ts",
    "packages/engine/src/__tests__/analyzers/feedback-loop.test.ts",
    "packages/engine/src/__tests__/analyzers/navigability.test.ts",
    "packages/engine/src/__tests__/analyzers/security-governance.test.ts",
    "packages/engine/src/__tests__/analyzers/test-isolation.test.ts",
    "packages/engine/src/__tests__/budget/budget-analyzer.test.ts",
    "packages/engine/src/__tests__/fix/generators.test.ts",
]
for f in files:
    os.makedirs(os.path.dirname(f), exist_ok=True)
    content = subprocess.check_output(["git", "show", "HEAD:" + f])
    with open(f, "wb") as fh:
        fh.write(content)
    print("Restored: " + f)
print("Done!")
