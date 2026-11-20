// Serverless-safe MongoDB connection using a global singleton.
// Prevents creating a new connection on every hot-reloaded module invocation.
import mongoose from "mongoose";

declare global {
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
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not configured");
    }
    const opts: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };
    global._mongoosePromise = mongoose
      .connect(uri, opts)
      .then((m) => m.connection)
      .catch((err) => {
        // Never cache a failed attempt: the next request must retry.
        global._mongoosePromise = null;
        global._mongooseConn = null;
        throw err;
      });
  }

  global._mongooseConn = await global._mongoosePromise;
  return global._mongooseConn;
}

export default getDb;
