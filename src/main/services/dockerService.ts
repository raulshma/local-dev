import { promises as fs } from 'fs';
import * as path from 'path';

export interface DockerConfiguration {
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasDockerIgnore: boolean;
  dockerComposeFiles: string[];
  dockerfileLocation?: string;
}

export interface DockerScript {
  id: string;
  name: string;
  command: string;
  type: 'build' | 'run' | 'compose-up' | 'compose-down' | 'logs' | 'stop';
  isAutoDetected: boolean;
}

export class DockerService {
  /**
   * Detect Docker configuration in a project directory
   */
  static async detectDockerConfiguration(projectPath: string): Promise<DockerConfiguration> {
    const config: DockerConfiguration = {
      hasDockerfile: false,
      hasDockerCompose: false,
      hasDockerIgnore: false,
      dockerComposeFiles: [],
    };

    try {
      const files = await fs.readdir(projectPath);

      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile()) {
          // Check for Dockerfile
          if (file === 'Dockerfile' || file === 'dockerfile') {
            config.hasDockerfile = true;
            config.dockerfileLocation = filePath;
          }

          // Check for Docker Compose files
          if (file === 'docker-compose.yml' ||
              file === 'docker-compose.yaml' ||
              file === 'compose.yml' ||
              file === 'compose.yaml' ||
              file.startsWith('docker-compose.') ||
              file.startsWith('compose.')) {
            config.hasDockerCompose = true;
            config.dockerComposeFiles.push(file);
          }

          // Check for .dockerignore
          if (file === '.dockerignore') {
            config.hasDockerIgnore = true;
          }
        }
      }
    } catch (error) {
      console.error('Error detecting Docker configuration:', error);
    }

    return config;
  }

  /**
   * Generate auto-detected Docker scripts based on configuration
   */
  static generateDockerScripts(projectPath: string, config: DockerConfiguration): DockerScript[] {
    const scripts: DockerScript[] = [];
    const projectName = path.basename(projectPath).toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Docker build script
    if (config.hasDockerfile) {
      scripts.push({
        id: 'docker-build',
        name: 'Docker Build',
        command: `docker build -t ${projectName} .`,
        type: 'build',
        isAutoDetected: true,
      });

      scripts.push({
        id: 'docker-run',
        name: 'Docker Run',
        command: `docker run --rm -it ${projectName}`,
        type: 'run',
        isAutoDetected: true,
      });

      scripts.push({
        id: 'docker-run-daemon',
        name: 'Docker Run (Detached)',
        command: `docker run -d --name ${projectName}-container ${projectName}`,
        type: 'run',
        isAutoDetected: true,
      });
    }

    // Docker Compose scripts
    if (config.hasDockerCompose) {
      // Use the first compose file found
      const composeFile = config.dockerComposeFiles[0];

      scripts.push({
        id: 'docker-compose-up',
        name: 'Docker Compose Up',
        command: `docker-compose -f ${composeFile} up`,
        type: 'compose-up',
        isAutoDetected: true,
      });

      scripts.push({
        id: 'docker-compose-up-detached',
        name: 'Docker Compose Up (Detached)',
        command: `docker-compose -f ${composeFile} up -d`,
        type: 'compose-up',
        isAutoDetected: true,
      });

      scripts.push({
        id: 'docker-compose-down',
        name: 'Docker Compose Down',
        command: `docker-compose -f ${composeFile} down`,
        type: 'compose-down',
        isAutoDetected: true,
      });

      scripts.push({
        id: 'docker-compose-logs',
        name: 'Docker Compose Logs',
        command: `docker-compose -f ${composeFile} logs -f`,
        type: 'logs',
        isAutoDetected: true,
      });

      scripts.push({
        id: 'docker-compose-build',
        name: 'Docker Compose Build',
        command: `docker-compose -f ${composeFile} build`,
        type: 'build',
        isAutoDetected: true,
      });
    }

    // General Docker scripts
    scripts.push({
      id: 'docker-ps',
      name: 'Docker List Containers',
      command: 'docker ps -a',
      type: 'logs',
      isAutoDetected: true,
    });

    scripts.push({
      id: 'docker-images',
      name: 'Docker List Images',
      command: 'docker images',
      type: 'logs',
      isAutoDetected: true,
    });

    scripts.push({
      id: 'docker-stop-all',
      name: 'Docker Stop All Containers',
      command: 'docker stop $(docker ps -q)',
      type: 'stop',
      isAutoDetected: true,
    });

    return scripts;
  }

  /**
   * Check if Docker is available on the system
   */
  static async isDockerAvailable(): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('docker --version', (error: any) => {
          resolve(!error);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Get running Docker containers
   */
  static async getRunningContainers(): Promise<any[]> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve, reject) => {
        exec('docker ps --format "table {{.ID}}\\t{{.Image}}\\t{{.Command}}\\t{{.CreatedAt}}\\t{{.Status}}\\t{{.Ports}}\\t{{.Names}}"',
          (error: any, stdout: string, stderr: string) => {
            if (error) {
              reject(error);
              return;
            }

            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) {
              resolve([]);
              return;
            }

            // Skip header line and parse containers
            const containers = lines.slice(1).map((line: string) => {
              const parts = line.split('\t');
              return {
                id: parts[0] || '',
                image: parts[1] || '',
                command: parts[2] || '',
                created: parts[3] || '',
                status: parts[4] || '',
                ports: parts[5] || '',
                name: parts[6] || '',
              };
            });

            resolve(containers);
          }
        );
      });
    } catch (error) {
      console.error('Error getting running containers:', error);
      return [];
    }
  }

  /**
   * Get Docker images
   */
  static async getDockerImages(): Promise<any[]> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve, reject) => {
        exec('docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.CreatedAt}}\\t{{.Size}}"',
          (error: any, stdout: string, stderr: string) => {
            if (error) {
              reject(error);
              return;
            }

            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) {
              resolve([]);
              return;
            }

            // Skip header line and parse images
            const images = lines.slice(1).map((line: string) => {
              const parts = line.split('\t');
              return {
                repository: parts[0] || '',
                tag: parts[1] || '',
                id: parts[2] || '',
                created: parts[3] || '',
                size: parts[4] || '',
              };
            });

            resolve(images);
          }
        );
      });
    } catch (error) {
      console.error('Error getting Docker images:', error);
      return [];
    }
  }
}
