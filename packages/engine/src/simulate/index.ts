export {
  NativeExecutor,
  DockerExecutor,
  detectCommands,
  buildStepConfigs,
  runSimulationSteps,
} from "./runner.js";
export { compareStaticVsSimulation, predictionAccuracy } from "./comparison.js";
export {
  isDockerAvailable,
  hasDevcontainer,
  getDevcontainerImage,
  resolveIsolationMode,
} from "./docker.js";
export type {
  StepConfig,
  StepExecutor,
  OnSimulationProgress,
  SimulationProgressEvent,
  DetectedCommands,
} from "./types.js";
