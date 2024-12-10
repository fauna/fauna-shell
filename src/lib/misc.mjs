export class InvalidCredsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCredsError";
    this.status = 401;
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 403;
  }
}

export function isTTY() {
  return process.stdout.isTTY;
}
