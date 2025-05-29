import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const FolderIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zM14 13H2V7h12v6zm0-7H2V3h4.49l.35.15L7.69 4H14v2z"/>
  </svg>
);

export const FileIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M13.5 1h-7L6 1.5v1L6.5 3h7l.5.5v9l-.5.5h-7L6 12.5v1l.5.5h7l.5-.5v-11L13.5 1zM13 12V4H7v8h6z"/>
    <path d="M4.5 1h-3L1 1.5v11l.5.5h3l.5-.5v-11L4.5 1zM4 12H2V2h2v10z"/>
  </svg>
);

export const GitIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M15.698 7.287l-6.22-6.22a.75.75 0 0 0-1.061 0L6.831 2.653l1.345 1.345a.889.889 0 0 1 1.124 1.124l1.298 1.298a.889.889 0 0 1 .889 1.48L9.78 9.606a.889.889 0 0 1-1.124-.889V6.111a.889.889 0 0 1-.445-.076L6.831 7.415v4.704a.889.889 0 1 1-1.779 0V7.415L3.297 5.66a.889.889 0 0 1-.445.076v2.606a.889.889 0 1 1-1.124.889L.022 7.525a.75.75 0 0 0 0 1.061l6.22 6.22a.75.75 0 0 0 1.061 0l6.22-6.22a.75.75 0 0 0 0-1.061z"/>
  </svg>
);

export const TerminalIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M1.5 1h13l.5.5v13l-.5.5h-13l-.5-.5v-13L1.5 1zM2 14h12V2H2v12z"/>
    <path d="M4.78 8.22L7.56 11L4.78 13.78l.7.7L9.27 11L5.48 7.22l-.7.7z"/>
    <path d="M8 13h4v1H8v-1z"/>
  </svg>
);

export const CodeIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708L.586 8.224 4 4.87l.708.708zM7.773 2.226l3.354 3.354-3.354 3.354-.708-.708L9.711 5.58 7.065 2.934l.708-.708z"/>
    <path d="M6.06 13.909L10.424 2.636l.972.364-4.364 11.273-.972-.364z"/>
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.7-1.3 2 .8.8 2-1.3.7.3.5 2.4h1.2l.5-2.4.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V7.4l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3-.7-.3zM8 10.8c-1.5 0-2.8-1.3-2.8-2.8s1.3-2.8 2.8-2.8 2.8 1.3 2.8 2.8-1.3 2.8-2.8 2.8z"/>
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM6.5 4.5v7L11 8l-4.5-3.5z"/>
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM5 6h6v4H5V6z"/>
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M8 3.5a.5.5 0 0 1 .5.5v3.5H12a.5.5 0 0 1 0 1H8.5V12a.5.5 0 0 1-1 0V8.5H4a.5.5 0 0 1 0-1h3.5V4a.5.5 0 0 1 .5-.5z"/>
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M4.427 9.573L8 6l3.573 3.573-.618.618L8 7.236l-2.955 2.955-.618-.618z"/>
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M11.573 6.427L8 10l-3.573-3.573.618-.618L8 8.764l2.955-2.955.618.618z"/>
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm2.69-2.31L4.92 11l7.94-7.94.18.18L5.1 11.28zm8.55-8.55l-.18-.18.18-.18.18.18-.18.18zM13 3.41l-.18-.18.18-.18.18.18-.18.18z"/>
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M6.427 4.427L10 8l-3.573 3.573-.618-.618L8.764 8 5.809 5.045l.618-.618z"/>
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L10.68 11.74zM11.5 7a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0z"/>
  </svg>
);

export const ExtensionIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M13.5 1h-1l-.5.5v3l-.5.5H10V4.5l-.5-.5h-3l-.5.5V6H4.5l-.5.5v3l.5.5H6v1.5l.5.5h3l.5-.5V10h1.5l.5-.5v-3L11.5 6H10V4.5h1.5l.5-.5v-3L11.5 1h2zM10 9H9v1H7V9H6V7h1V6h2v1h1v2z"/>
  </svg>
);

export const DebugIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M9.83 4.5l1.5-1.5.7.7L10.54 5.2C11.6 5.9 12.3 7.1 12.3 8.5c0 .6-.1 1.2-.3 1.7l1.5 1.5-.7.7-1.5-1.5c-.7 1.1-1.9 1.8-3.3 1.8s-2.6-.7-3.3-1.8L2.2 12.4l-.7-.7 1.5-1.5c-.2-.5-.3-1.1-.3-1.7 0-1.4.7-2.6 1.7-3.3L2.97 3.7l.7-.7 1.5 1.5C5.7 4.2 6.3 4 7 4c.3 0 .6 0 .9.1L9.83 4.5zM8 5c-1.9 0-3.5 1.6-3.5 3.5S6.1 12 8 12s3.5-1.6 3.5-3.5S9.9 5 8 5z"/>
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M6.5 1h3l.5.5v1h4v1h-1v9.5l-.5.5h-9l-.5-.5V3.5h-1v-1h4v-1l.5-.5zM5 13h6V4H5v9zm1-8v7h1V5H6zm2 0v7h1V5H8zm2 0v7h1V5h-1zM6.5 2v.5h3V2h-3z"/>
  </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M13.5 1h-1l-.5.5v3l-.5.5H10V4.5l-.5-.5h-3l-.5.5V6H4.5l-.5.5v8l.5.5h9l.5-.5v-8L13.5 6V1.5l-.5-.5zM12 6v8H4V7h8V6zM6 5h4V2H6v3zm1-2h2v1H7V3z"/>
  </svg>
);

export const BackupIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M14.5 7h-1l-.5.5v6l-.5.5h-9l-.5-.5v-6L3 7H2l-.5.5v7l.5.5h11l.5-.5v-7L14.5 7z"/>
    <path d="M8.5 1h-1l-.5.5v8.793L5.854 9.146l-.708.708L8 12.707l2.854-2.853-.708-.708L8.5 10.293V1.5L8.5 1z"/>
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
    <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c-.335.415-.927 1.341-1.124 2.876l-.021.165.033.163.071.345c0 1.654-1.346 3-3 3s-3-1.346-3-3 1.346-3 3-3c.789 0 1.506.302 2.049.795l-1.049.804.030.022 3.22-.004v-3.21l-.486.497zm-7.864 4.781l.579.939 1.068-.812.076-.094c.335-.415.927-1.341 1.124-2.876l.021-.165-.033-.163-.071-.345c0-1.654 1.346-3 3-3s3 1.346 3 3-1.346 3-3 3c-.789 0-1.506-.302-2.049-.795l1.049-.804-.030-.022-3.22.004v3.21l.486-.497z"/>
  </svg>
);
