type Job = () => Promise<void> | void;

type EmailQueueOptions = {
  concurrency?: number;
  onError?: (error: unknown) => void;
};

// In-memory, bounded-concurrency queue so request handlers never await SMTP.
export const createEmailQueue = ({ concurrency = 2, onError }: EmailQueueOptions = {}) => {
  const pending: Job[] = [];
  let active = 0;

  const drain = () => {
    while (active < concurrency && pending.length > 0) {
      const job = pending.shift();
      if (!job) {
        return;
      }
      active += 1;
      Promise.resolve()
        .then(job)
        .catch((error) => onError?.(error))
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  return {
    enqueue(job: Job) {
      pending.push(job);
      drain();
    },
    get size() {
      return pending.length + active;
    },
  };
};

export type EmailQueue = ReturnType<typeof createEmailQueue>;
