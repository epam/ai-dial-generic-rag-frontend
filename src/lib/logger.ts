export const infoLog = (message: string): void => {
  console.info(message);
};

export const warnLog = (message: string): void => {
  console.warn(message);
};

export const errorLog = (message: string): void => {
  console.error(message);
};

export const errorObjLog = (error: unknown, message: string): void => {
  const errorMessage =
    (error as { message?: string })?.message ?? 'Unknown error';
  const errorStack =
    (error as { stack?: string })?.stack ?? 'No stack trace available';
  console.error(message, { message: errorMessage, stack: errorStack });
};
