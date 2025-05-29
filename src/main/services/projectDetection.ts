import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ProjectType, DetectedScript } from '../types';

export class ProjectDetectionService {
  /**
   * Detect project type based on files present in the project directory
   */
  async detectProjectType(projectPath: string): Promise<ProjectType[]> {
    const detections: ProjectType[] = [];

    try {
      const files = await fs.readdir(projectPath);
      const fileSet = new Set(files);

      // JavaScript/Node.js Detection
      if (fileSet.has('package.json')) {
        const packageJsonPath = path.join(projectPath, 'package.json');
        try {
          const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          let confidence = 0.9;
          let indicators = ['package.json'];
          
          // Check for framework-specific dependencies
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          if (dependencies.react || dependencies['@types/react']) {
            detections.push({
              type: 'react',
              confidence: 0.95,
              indicators: ['package.json', 'React dependencies']
            });
          }
          
          if (dependencies.next) {
            detections.push({
              type: 'nextjs',
              confidence: 0.95,
              indicators: ['package.json', 'Next.js dependencies']
            });
          }
          
          if (dependencies.vue || dependencies['@vue/core']) {
            detections.push({
              type: 'vue',
              confidence: 0.95,
              indicators: ['package.json', 'Vue dependencies']
            });
          }
          
          if (dependencies.vite) {
            detections.push({
              type: 'vite',
              confidence: 0.9,
              indicators: ['package.json', 'Vite dependencies']
            });
          }
          
          // General Node.js project
          detections.push({
            type: 'nodejs',
            confidence,
            indicators
          });
        } catch (error) {
          console.warn('Error reading package.json:', error);
        }
      }

      // Python Detection
      const pythonIndicators = [];
      if (fileSet.has('requirements.txt')) pythonIndicators.push('requirements.txt');
      if (fileSet.has('pyproject.toml')) pythonIndicators.push('pyproject.toml');
      if (fileSet.has('setup.py')) pythonIndicators.push('setup.py');
      if (fileSet.has('Pipfile')) pythonIndicators.push('Pipfile');
      if (fileSet.has('poetry.lock')) pythonIndicators.push('poetry.lock');

      if (pythonIndicators.length > 0) {
        let confidence = 0.7 + (pythonIndicators.length * 0.1);
        confidence = Math.min(confidence, 0.95);

        // Django detection
        if (fileSet.has('manage.py')) {
          detections.push({
            type: 'django',
            confidence: 0.95,
            indicators: [...pythonIndicators, 'manage.py']
          });
        }
        
        // Flask detection
        if (files.some(file => file === 'app.py' || file === 'main.py' || file === 'wsgi.py')) {
          const flaskIndicators = [...pythonIndicators];
          if (fileSet.has('app.py')) flaskIndicators.push('app.py');
          if (fileSet.has('main.py')) flaskIndicators.push('main.py');
          
          detections.push({
            type: 'flask',
            confidence: 0.85,
            indicators: flaskIndicators
          });
        }
        
        // FastAPI detection
        if (files.some(file => file === 'main.py') && pythonIndicators.includes('requirements.txt')) {
          try {
            const reqPath = path.join(projectPath, 'requirements.txt');
            const reqContent = await fs.readFile(reqPath, 'utf-8');
            if (reqContent.includes('fastapi') || reqContent.includes('uvicorn')) {
              detections.push({
                type: 'fastapi',
                confidence: 0.9,
                indicators: [...pythonIndicators, 'FastAPI in requirements']
              });
            }
          } catch (error) {
            console.warn('Error reading requirements.txt:', error);
          }
        }

        // General Python project
        detections.push({
          type: 'python',
          confidence,
          indicators: pythonIndicators
        });
      }

      // .NET/C# Detection
      const dotnetFiles = files.filter(file => 
        file.endsWith('.csproj') || 
        file.endsWith('.sln') || 
        file.endsWith('.fsproj') || 
        file.endsWith('.vbproj')
      );

      if (dotnetFiles.length > 0) {
        detections.push({
          type: 'dotnet',
          confidence: 0.9,
          indicators: dotnetFiles
        });
      }

      // Rust Detection
      if (fileSet.has('Cargo.toml')) {
        detections.push({
          type: 'rust',
          confidence: 0.9,
          indicators: ['Cargo.toml']
        });
      }

      // Go Detection
      if (fileSet.has('go.mod') || files.some(file => file.endsWith('.go'))) {
        const indicators = [];
        if (fileSet.has('go.mod')) indicators.push('go.mod');
        if (files.some(file => file.endsWith('.go'))) indicators.push('.go files');
        
        detections.push({
          type: 'go',
          confidence: 0.9,
          indicators
        });
      }

      // Java Detection
      if (fileSet.has('pom.xml') || fileSet.has('build.gradle') || files.some(file => file.endsWith('.java'))) {
        const indicators = [];
        if (fileSet.has('pom.xml')) indicators.push('pom.xml');
        if (fileSet.has('build.gradle')) indicators.push('build.gradle');
        if (files.some(file => file.endsWith('.java'))) indicators.push('.java files');
        
        detections.push({
          type: 'java',
          confidence: 0.85,
          indicators
        });
      }

    } catch (error) {
      console.error('Error detecting project type:', error);
    }

    // Sort by confidence descending
    return detections.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate scripts based on detected project types
   */
  async generateScripts(projectPath: string, detectedTypes: ProjectType[]): Promise<DetectedScript[]> {
    const scripts: DetectedScript[] = [];

    for (const detection of detectedTypes) {
      const projectScripts = await this.getScriptsForProjectType(projectPath, detection.type);
      scripts.push(...projectScripts);
    }    // Remove duplicates and sort by priority
    const uniqueScripts = scripts.reduce((acc: DetectedScript[], script: DetectedScript) => {
      const existing = acc.find((s: DetectedScript) => s.name === script.name);
      if (!existing || existing.priority < script.priority) {
        acc = acc.filter((s: DetectedScript) => s.name !== script.name);
        acc.push(script);
      }
      return acc;
    }, [] as DetectedScript[]);

    return uniqueScripts.sort((a: DetectedScript, b: DetectedScript) => b.priority - a.priority);
  }

  /**
   * Get scripts for a specific project type
   */
  private async getScriptsForProjectType(projectPath: string, projectType: string): Promise<DetectedScript[]> {
    switch (projectType) {
      case 'nodejs':
      case 'react':
      case 'vue':
      case 'vite':
      case 'nextjs':
        return this.getNodeJsScripts(projectPath, projectType);
      
      case 'python':
        return this.getPythonScripts(projectPath);
      
      case 'django':
        return this.getDjangoScripts(projectPath);
      
      case 'flask':
      case 'fastapi':
        return this.getFlaskFastAPIScripts(projectPath, projectType);
      
      case 'dotnet':
        return this.getDotNetScripts(projectPath);
      
      case 'rust':
        return this.getRustScripts(projectPath);
      
      case 'go':
        return this.getGoScripts(projectPath);
      
      case 'java':
        return this.getJavaScripts(projectPath);
      
      default:
        return [];
    }
  }

  private async getNodeJsScripts(projectPath: string, projectType: string): Promise<DetectedScript[]> {
    const scripts: DetectedScript[] = [];
    
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Get scripts from package.json
        if (packageJson.scripts) {
          const scriptPriorities: Record<string, number> = {
            'dev': 10,
            'start': 9,
            'build': 8,
            'test': 7,
            'lint': 6,
            'serve': 5,
            'preview': 4
          };

          for (const [scriptName, command] of Object.entries(packageJson.scripts)) {
            const priority = scriptPriorities[scriptName] || 3;
            scripts.push({
              name: `npm run ${scriptName}`,
              command: `npm run ${scriptName}`,
              projectType,
              priority
            });
          }
        }

        // Add common package manager alternatives
        const hasYarn = existsSync(path.join(projectPath, 'yarn.lock'));
        const hasPnpm = existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
        
        if (packageJson.scripts?.dev) {
          if (hasYarn) {
            scripts.push({
              name: 'yarn dev',
              command: 'yarn dev',
              projectType,
              priority: 10
            });
          }
          if (hasPnpm) {
            scripts.push({
              name: 'pnpm dev',
              command: 'pnpm dev',
              projectType,
              priority: 10
            });
          }
        }

        if (packageJson.scripts?.start) {
          if (hasYarn) {
            scripts.push({
              name: 'yarn start',
              command: 'yarn start',
              projectType,
              priority: 9
            });
          }
          if (hasPnpm) {
            scripts.push({
              name: 'pnpm start',
              command: 'pnpm start',
              projectType,
              priority: 9
            });
          }
        }
      }

      // Add install commands
      scripts.push({
        name: 'npm install',
        command: 'npm install',
        projectType,
        priority: 2
      });

    } catch (error) {
      console.warn('Error reading package.json scripts:', error);
    }

    return scripts;
  }

  private async getPythonScripts(projectPath: string): Promise<DetectedScript[]> {
    const scripts: DetectedScript[] = [];

    // Common Python scripts
    scripts.push({
      name: 'pip install requirements',
      command: 'pip install -r requirements.txt',
      projectType: 'python',
      priority: 8
    });

    scripts.push({
      name: 'pytest',
      command: 'python -m pytest',
      projectType: 'python',
      priority: 6
    });

    // Check for main.py or app.py
    if (existsSync(path.join(projectPath, 'main.py'))) {
      scripts.push({
        name: 'python main.py',
        command: 'python main.py',
        projectType: 'python',
        priority: 9
      });
    }

    if (existsSync(path.join(projectPath, 'app.py'))) {
      scripts.push({
        name: 'python app.py',
        command: 'python app.py',
        projectType: 'python',
        priority: 9
      });
    }

    return scripts;
  }

  private async getDjangoScripts(projectPath: string): Promise<DetectedScript[]> {
    return [
      {
        name: 'runserver',
        command: 'python manage.py runserver',
        projectType: 'django',
        priority: 10
      },
      {
        name: 'migrate',
        command: 'python manage.py migrate',
        projectType: 'django',
        priority: 8
      },
      {
        name: 'makemigrations',
        command: 'python manage.py makemigrations',
        projectType: 'django',
        priority: 7
      },
      {
        name: 'test',
        command: 'python manage.py test',
        projectType: 'django',
        priority: 6
      },
      {
        name: 'shell',
        command: 'python manage.py shell',
        projectType: 'django',
        priority: 5
      }
    ];
  }

  private async getFlaskFastAPIScripts(projectPath: string, projectType: string): Promise<DetectedScript[]> {
    const scripts: DetectedScript[] = [];

    if (projectType === 'fastapi') {
      scripts.push({
        name: 'uvicorn dev server',
        command: 'uvicorn main:app --reload',
        projectType,
        priority: 10
      });
    }

    if (existsSync(path.join(projectPath, 'app.py'))) {
      scripts.push({
        name: projectType === 'flask' ? 'flask run' : 'python app.py',
        command: projectType === 'flask' ? 'flask run' : 'python app.py',
        projectType,
        priority: 9
      });
    }

    if (existsSync(path.join(projectPath, 'main.py'))) {
      scripts.push({
        name: 'python main.py',
        command: 'python main.py',
        projectType,
        priority: 9
      });
    }

    return scripts;
  }

  private async getDotNetScripts(projectPath: string): Promise<DetectedScript[]> {
    return [
      {
        name: 'dotnet run',
        command: 'dotnet run',
        projectType: 'dotnet',
        priority: 10
      },
      {
        name: 'dotnet build',
        command: 'dotnet build',
        projectType: 'dotnet',
        priority: 8
      },
      {
        name: 'dotnet test',
        command: 'dotnet test',
        projectType: 'dotnet',
        priority: 7
      },
      {
        name: 'dotnet watch run',
        command: 'dotnet watch run',
        projectType: 'dotnet',
        priority: 9
      },
      {
        name: 'dotnet restore',
        command: 'dotnet restore',
        projectType: 'dotnet',
        priority: 6
      }
    ];
  }

  private async getRustScripts(projectPath: string): Promise<DetectedScript[]> {
    return [
      {
        name: 'cargo run',
        command: 'cargo run',
        projectType: 'rust',
        priority: 10
      },
      {
        name: 'cargo build',
        command: 'cargo build',
        projectType: 'rust',
        priority: 8
      },
      {
        name: 'cargo test',
        command: 'cargo test',
        projectType: 'rust',
        priority: 7
      },
      {
        name: 'cargo check',
        command: 'cargo check',
        projectType: 'rust',
        priority: 6
      }
    ];
  }

  private async getGoScripts(projectPath: string): Promise<DetectedScript[]> {
    return [
      {
        name: 'go run',
        command: 'go run .',
        projectType: 'go',
        priority: 10
      },
      {
        name: 'go build',
        command: 'go build',
        projectType: 'go',
        priority: 8
      },
      {
        name: 'go test',
        command: 'go test ./...',
        projectType: 'go',
        priority: 7
      },
      {
        name: 'go mod tidy',
        command: 'go mod tidy',
        projectType: 'go',
        priority: 6
      }
    ];
  }

  private async getJavaScripts(projectPath: string): Promise<DetectedScript[]> {
    const scripts: DetectedScript[] = [];

    if (existsSync(path.join(projectPath, 'pom.xml'))) {
      scripts.push(
        {
          name: 'mvn compile',
          command: 'mvn compile',
          projectType: 'java',
          priority: 8
        },
        {
          name: 'mvn spring-boot:run',
          command: 'mvn spring-boot:run',
          projectType: 'java',
          priority: 10
        },
        {
          name: 'mvn test',
          command: 'mvn test',
          projectType: 'java',
          priority: 7
        }
      );
    }

    if (existsSync(path.join(projectPath, 'build.gradle'))) {
      scripts.push(
        {
          name: 'gradle build',
          command: 'gradle build',
          projectType: 'java',
          priority: 8
        },
        {
          name: 'gradle bootRun',
          command: 'gradle bootRun',
          projectType: 'java',
          priority: 10
        },
        {
          name: 'gradle test',
          command: 'gradle test',
          projectType: 'java',
          priority: 7
        }
      );
    }

    return scripts;
  }

  /**
   * Find the best development command for a project
   */
  async findBestDevCommand(projectPath: string): Promise<{ command: string; projectType: string } | null> {
    const detectedTypes = await this.detectProjectType(projectPath);
    if (detectedTypes.length === 0) return null;

    const scripts = await this.generateScripts(projectPath, detectedTypes);
    
    // Find the highest priority script that's likely a dev server
    const devScripts = scripts.filter(script => 
      script.name.includes('dev') || 
      script.name.includes('start') || 
      script.name.includes('run') ||
      script.name.includes('server')
    );

    if (devScripts.length > 0) {
      const bestScript = devScripts[0];
      return {
        command: bestScript.command,
        projectType: bestScript.projectType
      };
    }

    // Fallback to highest priority script
    if (scripts.length > 0) {
      return {
        command: scripts[0].command,
        projectType: scripts[0].projectType
      };
    }

    return null;
  }
}
