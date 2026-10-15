export async function withProposalTimeout<T>(task: PromiseLike<T>, milliseconds = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(task), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Proposals took too long to load. Please try again.")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

