export interface DataService {
  initializeData(): void | Promise<void>;
  clearData(): void | Promise<void>;
  getEnvironmentName(): string;
}