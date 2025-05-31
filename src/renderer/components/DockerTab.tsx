import React, { useState, useEffect } from 'react';
import { DockerConfiguration, DockerContainer, DockerImage, DockerScript } from '../../types';

interface DockerTabProps {
  projectId: string;
}

const DockerTab: React.FC<DockerTabProps> = ({ projectId }) => {
  const [dockerConfig, setDockerConfig] = useState<DockerConfiguration | null>(null);
  const [dockerScripts, setDockerScripts] = useState<DockerScript[]>([]);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [isDockerAvailable, setIsDockerAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDockerData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if Docker is available
      const availabilityResult = await window.electron.docker.isAvailable();
      if (availabilityResult.success) {
        setIsDockerAvailable(availabilityResult.isAvailable);
      }

      if (!availabilityResult.isAvailable) {
        return;
      }

      // Detect Docker configuration for the project
      const configResult = await window.electron.docker.detectConfiguration(projectId);
      if (configResult.success && configResult.config) {
        setDockerConfig(configResult.config);

        // Generate Docker scripts
        const scriptsResult = await window.electron.docker.generateScripts(projectId);
        if (scriptsResult.success && scriptsResult.scripts) {
          setDockerScripts(scriptsResult.scripts);
        }
      }

      // Load running containers
      const containersResult = await window.electron.docker.getContainers();
      if (containersResult.success) {
        setContainers(containersResult.containers);
      }

      // Load Docker images
      const imagesResult = await window.electron.docker.getImages();
      if (imagesResult.success) {
        setImages(imagesResult.images);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDockerData();
  }, [projectId]);

  const handleRefresh = () => {
    loadDockerData();
  };

  const handleExecuteScript = async (script: DockerScript) => {
    try {
      // Execute the Docker script using the existing script execution system
      // This assumes we add the Docker scripts to the project's script list
      // For now, we'll just show an alert - this can be enhanced later
      if (window.confirm(`Execute: ${script.command}?`)) {
        // Note: This would need integration with the script execution system
        alert('Docker script execution would be integrated with the main script system');
      }
    } catch (err) {
      setError('Failed to execute Docker script');
    }
  };

  if (isLoading) {
    return (
      <div className="docker-tab">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading Docker information...</span>
        </div>
      </div>
    );
  }

  if (!isDockerAvailable) {
    return (
      <div className="docker-tab">
        <div className="docker-unavailable">
          <h3>🐳 Docker Not Available</h3>
          <p>Docker is not installed or not running on this system.</p>
          <p>Please install Docker Desktop or ensure Docker is running to use Docker features.</p>
          <button type="button" className="refresh-btn" onClick={handleRefresh}>
            🔄 Check Again
          </button>
        </div>
      </div>
    );
  }

  if (!dockerConfig || (!dockerConfig.hasDockerfile && !dockerConfig.hasDockerCompose)) {
    return (
      <div className="docker-tab">
        <div className="docker-unavailable">
          <h3>📄 No Docker Configuration</h3>
          <p>This project does not have Docker configuration files.</p>
          <p>Add a Dockerfile or docker-compose.yml to enable Docker features.</p>
          <button type="button" className="refresh-btn" onClick={handleRefresh}>
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="docker-tab">
      {error && (
        <div className="error-message">
          <span>⚠️</span>
          {error}
          <button
            type="button"
            className="close-error"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Docker Configuration */}
      <div className="docker-section">
        <h3>🐳 Docker Configuration</h3>
        <div className="docker-config-info">
          <div className={`docker-config-item ${dockerConfig.hasDockerfile ? 'present' : 'missing'}`}>
            {dockerConfig.hasDockerfile ? '✅' : '❌'} Dockerfile
          </div>
          <div className={`docker-config-item ${dockerConfig.hasDockerCompose ? 'present' : 'missing'}`}>
            {dockerConfig.hasDockerCompose ? '✅' : '❌'} Docker Compose
          </div>
          <div className={`docker-config-item ${dockerConfig.hasDockerIgnore ? 'present' : 'missing'}`}>
            {dockerConfig.hasDockerIgnore ? '✅' : '❌'} .dockerignore
          </div>
          {dockerConfig.dockerComposeFiles.length > 0 && (
            <div className="docker-config-item present">
              📄 {dockerConfig.dockerComposeFiles.length} compose file(s)
            </div>
          )}
        </div>
        <button type="button" className="refresh-btn" onClick={handleRefresh}>
          🔄 Refresh
        </button>
      </div>

      {/* Docker Scripts */}
      {dockerScripts.length > 0 && (
        <div className="docker-section">
          <h3>🛠️ Docker Scripts</h3>
          <div className="docker-scripts-grid">
            {dockerScripts.map((script) => (
              <div
                key={script.id}
                className="docker-script-card"
                onClick={() => handleExecuteScript(script)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleExecuteScript(script);
                  }
                }}
              >
                <div className="docker-script-name">{script.name}</div>
                <div className="docker-script-command">{script.command}</div>
                <div className="docker-script-type">{script.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running Containers */}
      {containers.length > 0 && (
        <div className="docker-section">
          <h3>📦 Running Containers ({containers.length})</h3>
          <div className="docker-containers-list">
            {containers.map((container) => (              <div key={container.id} className="docker-container-item">
                <div className="docker-container-info">
                  <div className="docker-container-name">{container.name}</div>
                  <div className="docker-container-status">
                    {container.image} • {container.status}
                  </div>
                  {container.ports && (
                    <div className="docker-container-ports">
                      🌐 Ports: {container.ports}
                    </div>
                  )}
                </div>
                <div className="docker-container-actions">                  <button
                    type="button"
                    className="docker-action-btn"
                    title="View logs - Opens terminal"
                    onClick={async () => {
                      try {
                        await window.electron.actions.openTerminal(projectId);
                        // Note: User will need to manually run: docker logs ${container.name}
                      } catch (err) {
                        setError('Failed to open terminal');
                      }
                    }}
                  >
                    📋 Logs
                  </button>
                  <button
                    type="button"
                    className="docker-action-btn"
                    title="Open terminal for shell access"
                    onClick={async () => {
                      try {
                        await window.electron.actions.openTerminal(projectId);
                        // Note: User will need to manually run: docker exec -it ${container.name} /bin/bash
                      } catch (err) {
                        setError('Failed to open terminal');
                      }
                    }}
                  >
                    🖥️ Shell
                  </button>
                  <button
                    type="button"
                    className="docker-action-btn danger"
                    title="Stop container"
                    onClick={async () => {                      if (window.confirm(`Are you sure you want to stop container "${container.name}"?`)) {
                        try {
                          await window.electron.actions.openTerminal(projectId);
                          // Note: User will need to manually run: docker stop ${container.name}
                          // Refresh containers list after some time
                          setTimeout(() => {
                            handleRefresh();
                          }, 2000);
                        } catch (err) {
                          setError('Failed to open terminal');
                        }
                      }
                    }}
                  >
                    ⏹️ Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Docker Images */}
      {images.length > 0 && (
        <div className="docker-section">
          <h3>🖼️ Docker Images ({images.length})</h3>
          <div className="docker-images-list">
            {images.slice(0, 10).map((image) => (
              <div key={`${image.repository}:${image.tag}`} className="docker-image-item">
                <div className="docker-image-info">
                  <div className="docker-image-name">{image.repository}:{image.tag}</div>
                  <div className="docker-image-details">
                    {image.size} • Created {image.created}
                  </div>
                </div>
              </div>
            ))}
            {images.length > 10 && (
              <div className="docker-image-item">
                <div className="docker-image-info">
                  <div className="docker-image-name">... and {images.length - 10} more images</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerTab;
