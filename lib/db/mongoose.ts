// Serverless-safe MongoDB connection using a global singleton.
// Prevents creating a new connection on every hot-reloaded module invocation.
import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: mongoose.Connection | null;
  var _mongoosePromise: Promise<mongoose.Connection> | null;
}

global._mongooseConn = global._mongooseConn ?? null;
global._mongoosePromise = global._mongoosePromise ?? null;

export async function getDb(): Promise<mongoose.Connection> {
  if (global._mongooseConn && global._mongooseConn.readyState === 1) {
    return global._mongooseConn;
  }

  if (!global._mongoosePromise) {
    const opts: mongoose.ConnectOptions = {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    };
    global._mongoosePromise = mongoose
      .connect(process.env.MONGODB_URI!, opts)
      .then((m) => m.connection);
  }

  global._mongooseConn = await global._mongoosePromise;
  return global._mongooseConn;
}

export default getDb;
