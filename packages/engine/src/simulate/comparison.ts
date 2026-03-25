/**
 * Static analysis vs simulation comparison (P3.05).
 *
 * Compares what the static scan predicted about agent readiness
 * with what actually happened during simulation.
 */
import type {
  ScanResult,
  PredictionComparison,
  SimulationStepResult,
} from "@prontiq/ariscan-schema";

/**
 * Generate comparison entries between static scan predictions and simulation results.
 *
 * This maps specific scan findings to simulation step outcomes to measure
 * how accurately static analysis predicts real-world agent experience.
 */
export function compareStaticVsSimulation(
  scanResult: ScanResult,
  stepResults: SimulationStepResult[],
): PredictionComparison[] {
  const comparisons: PredictionComparison[] = [];

  // Compare P4 (Dev Environment) predictions with bootstrap step
  const bootstrapStep = stepResults.find((s) => s.step === "bootstrap");
  if (bootstrapStep) {
    comparisons.push(compareBootstrap(scanResult, bootstrapStep));
  }

  // Compare P6 (Build Determinism & Type Safety) with typecheck step
  const typecheckStep = stepResults.find((s) => s.step === "typecheck");
  if (typecheckStep) {
    comparisons.push(compareTypecheck(scanResult, typecheckStep));
  }

  // Compare P3 (Test Isolation) with test step
  const testStep = stepResults.find((s) => s.step === "test");
  if (testStep) {
    comparisons.push(compareTest(scanResult, testStep));
  }

  // Compare P2 (Feedback Loop Speed) with overall time-to-green
  comparisons.push(compareFeedbackLoop(scanResult, stepResults));

  return comparisons;
}

function compareBootstrap(
  scanResult: ScanResult,
  step: SimulationStepResult,
): PredictionComparison {
  const p4 = scanResult.pillars.find((p) => p.pillar === "P4");
  const p4Score = p4?.score ?? 0;
  const highScore = p4Score >= 60;

  if (step.status === "skip") {
    return {
      prediction: highScore
        ? "Dev environment setup likely to succeed (P4 score: " + p4Score + ")"
        : "Dev environment setup may have issues (P4 score: " + p4Score + ")",
      reality: "Bootstrap step was skipped (no command detected)",
      accurate: false,
      pillar: "P4",
    };
  }

  const passed = step.status === "pass";

  return {
    prediction: highScore
      ? `Dev environment setup likely to succeed (P4 score: ${p4Score})`
      : `Dev environment setup may have issues (P4 score: ${p4Score})`,
    reality: passed
      ? `Bootstrap succeeded in ${step.durationMs}ms`
      : `Bootstrap failed (exit code: ${step.exitCode})`,
    accurate: highScore === passed,
    pillar: "P4",
  };
}

function compareTypecheck(
  scanResult: ScanResult,
  step: SimulationStepResult,
): PredictionComparison {
  const p6 = scanResult.pillars.find((p) => p.pillar === "P6");
  const p6Score = p6?.score ?? 0;
  const highScore = p6Score >= 60;

  if (step.status === "skip") {
    return {
      prediction: highScore
        ? `Type checking likely to pass (P6 score: ${p6Score})`
        : `Type checking may have issues (P6 score: ${p6Score})`,
      reality: "Typecheck step was skipped (no command detected)",
      accurate: !highScore, // If we predicted issues and there's no typecheck, that's somewhat accurate
      pillar: "P6",
    };
  }

  const passed = step.status === "pass";

  return {
    prediction: highScore
      ? `Type checking likely to pass (P6 score: ${p6Score})`
      : `Type checking may have issues (P6 score: ${p6Score})`,
    reality: passed
      ? `Typecheck passed in ${step.durationMs}ms`
      : `Typecheck failed (exit code: ${step.exitCode})`,
    accurate: highScore === passed,
    pillar: "P6",
  };
}

function compareTest(scanResult: ScanResult, step: SimulationStepResult): PredictionComparison {
  const p3 = scanResult.pillars.find((p) => p.pillar === "P3");
  const p3Score = p3?.score ?? 0;
  const highScore = p3Score >= 60;

  if (step.status === "skip") {
    return {
      prediction: highScore
        ? `Tests likely to pass (P3 score: ${p3Score})`
        : `Tests may have issues (P3 score: ${p3Score})`,
      reality: "Test step was skipped (no command detected)",
      accurate: !highScore,
      pillar: "P3",
    };
  }

  const passed = step.status === "pass";

  return {
    prediction: highScore
      ? `Tests likely to pass (P3 score: ${p3Score})`
      : `Tests may have issues (P3 score: ${p3Score})`,
    reality: passed
      ? `Tests passed in ${step.durationMs}ms`
      : `Tests failed (exit code: ${step.exitCode})`,
    accurate: highScore === passed,
    pillar: "P3",
  };
}

function compareFeedbackLoop(
  scanResult: ScanResult,
  stepResults: SimulationStepResult[],
): PredictionComparison {
  const p2 = scanResult.pillars.find((p) => p.pillar === "P2");
  const p2Score = p2?.score ?? 0;
  const highScore = p2Score >= 60;

  const totalMs = stepResults
    .filter((s) => s.status !== "skip")
    .reduce((sum, s) => sum + s.durationMs, 0);

  const allPassed = stepResults.every((s) => s.status === "pass" || s.status === "skip");
  // Consider fast if total time < 5 minutes
  const fast = totalMs < 300_000;

  return {
    prediction: highScore
      ? `Feedback loop likely fast (P2 score: ${p2Score})`
      : `Feedback loop may be slow (P2 score: ${p2Score})`,
    reality: allPassed
      ? `All steps completed in ${Math.round(totalMs / 1000)}s (${fast ? "fast" : "slow"})`
      : `Simulation failed after ${Math.round(totalMs / 1000)}s`,
    accurate: highScore === (allPassed && fast),
    pillar: "P2",
  };
}

/**
 * Calculate prediction accuracy as a percentage.
 */
export function predictionAccuracy(comparisons: PredictionComparison[]): number {
  if (comparisons.length === 0) return 0;
  const accurate = comparisons.filter((c) => c.accurate).length;
  return Math.round((accurate / comparisons.length) * 100);
}
