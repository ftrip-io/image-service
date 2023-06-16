import { spawn } from "child_process";
import { request } from "http";

let serverProcess;

const startServer = () => {
  return new Promise((resolve, reject) => {
    serverProcess = spawn("node", ["server.js"]);

    serverProcess.stdout.on("data", (data) => {
      console.log(data.toString());
      resolve();
    });

    serverProcess.stderr.on("data", (data) => {
      reject(new Error(data.toString()));
    });

    serverProcess.on("error", (error) => {
      reject(error);
    });

    serverProcess.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Server process exited with code ${code}`));
      }
    });
  });
};

const checkServerRunning = async () => {
  const response = await new Promise((resolve, reject) =>
    request({
      method: "GET",
      hostname: "localhost",
      port: process.env.PORT || 3001,
    })
      .on("response", resolve)
      .on("error", reject)
      .end()
  );
  if (response.statusCode === 200) {
    console.log("Server is running!");
    return;
  }
  throw Error("Server responded with status " + response.statusCode);
};

(async () => {
  try {
    await startServer();
    await checkServerRunning();
  } catch (error) {
    throw error;
  } finally {
    if (serverProcess) {
      console.log("Stopping the server...");
      serverProcess.kill("SIGTERM");
    }
  }
})();
