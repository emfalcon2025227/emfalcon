// Global ambient declarations for all test suites and report types
export {};

declare global {
  interface Window {
    [key: string]: any;
  }

  type PhaseReport = { status: string; passed: boolean; score?: number; tests?: any[]; results?: any[]; passCount?: number; failCount?: number; totalTests?: number; passedCount?: number; totalCount?: number; summary?: any; items?: any[]; invariantChecks?: any[]; testResults?: any[] };
  type P49TestResult = any;
  type P49TestReport = any;
  type P50TestReport = any;
  type P51TestResult = any;
  type P51TestReport = any;
  type P52TestReport = any;
  type Phase14Report = any;
  type Phase14TestResultItem = any;
  type Phase13TestReport = any;
  type Phase11TestReport = any;
  type Phase23TestSuiteReport = any;
  type Phase26TestReport = any;
  type Phase27TestReport = any;
  type Phase1TestReport = any;
  type Phase2TestResult = any;
  type Phase18TestResult = any;
  type Phase31TestReport = any;
  type Phase25TestResult = any;
  type Phase14TestReport = any;
  type Phase16TestReport = any;
  type Phase24TestReport = any;
  type Phase30TestReport = any;
  type P33TestReport = any;
  type P34TestReport = any;
  type P35TestReport = any;
  type P36TestReport = any;
  type P37TestReport = any;
  type P38TestReport = any;
  type P39TestReport = any;
  type P40TestReport = any;
  type P41TestReport = any;
  type P42TestReport = any;
  type P43TestReport = any;
  type P44TestReport = any;

  function runAllPhase1FinancialTests(...args: any[]): any;
  function runPhase2FinancialTests(...args: any[]): any;
  function runPhase7AReconEngine(...args: any[]): any;
  function runPhase11ReportingTests(...args: any[]): any;
  function runPhase12NotificationTests(...args: any[]): any;
  function runPhase13CommunicationTests(...args: any[]): any;
  function runAllPhase14GovernanceTests(...args: any[]): any;
  function runPhase14AdministrationTests(...args: any[]): any;
  function runPhase16MaintenanceFinancialTests(...args: any[]): any;
  function runPhase18FinancialControlTests(...args: any[]): any;
  function runPhase19CollectionTests(...args: any[]): any;
  function runPhase23AdvancedReportingTests(...args: any[]): any;
  function runPhase24OperationalIntelligenceTests(...args: any[]): any;
  function runPhase25OperationalControlTests(...args: any[]): any;
  function runPhase25UITestSuite(...args: any[]): any;
  function runPhase26FinalUITestSuite(...args: any[]): any;
  function runPhase27SystemWideQATestSuite(...args: any[]): any;
  function runPhase28ProductionReadinessTests(...args: any[]): any;
  function runPhase29GoLiveReadinessTests(...args: any[]): any;
  function runPhase30ProductionOperationsTests(...args: any[]): any;
  function runPhase31FinalProductionGoLiveTests(...args: any[]): any;
  function runPhase33FinalProductionCertificationTests(...args: any[]): any;
  function runPhase34ProductionOperationsAndSecurityTests(...args: any[]): any;
  function runPhase35ProductionGovernanceTests(...args: any[]): any;
  function runPhase36ContinuousProductionMonitoringTests(...args: any[]): any;
  function runPhase37OperationalResilienceTests(...args: any[]): any;
  function runPhase38BusinessContinuityTests(...args: any[]): any;
  function runPhase39AdvancedContinuityTests(...args: any[]): any;
  function runPhase40OperationalExcellenceTests(...args: any[]): any;
  function runPhase41ChangeGovernanceAndReleaseTests(...args: any[]): any;
  function runPhase42ProductionReleaseExecutionTests(...args: any[]): any;
  function runPhase43FinalProductionAcceptanceTests(...args: any[]): any;
  function runPhase44ReturnedChequeAndLegalTests(...args: any[]): any;
  function runPhase45FinancialImmutabilityTests(...args: any[]): any;
  function runPhase46JudicialCollectionTests(...args: any[]): any;
  function runPhase49FinancialClosingTests(...args: any[]): any;
  function runPhase50PeriodReconciliationTests(...args: any[]): any;
  function runPhase51ContinuousFinancialControlTests(...args: any[]): any;
  function runPhase52DailyDepositsForensicTests(...args: any[]): any;
  function runPhase53DailyRevenueCollectionTests(...args: any[]): any;
  function runPhase54EndToEndFinancialReconciliationTests(...args: any[]): any;
  function runPhase55FinancialReportingReconciliationTests(...args: any[]): any;
  function runDRSimulation(...args: any[]): any;
  function healthCheck(...args: any[]): any;
}
