type StateDirEnvSnapshot = {
  nemoStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    nemoStateDir: process.env.NEMO_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.nemoStateDir === undefined) {
    delete process.env.NEMO_STATE_DIR;
  } else {
    process.env.NEMO_STATE_DIR = snapshot.nemoStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.NEMO_STATE_DIR = stateDir;
}
