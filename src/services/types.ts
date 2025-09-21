export interface DataService {
  initializeData(): void;
  clearData(): void;
  getEnvironmentName(): string;
}