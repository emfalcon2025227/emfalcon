import * as testModule from './phase53DailyRevenueCollectionTests';
import { runPortalRegressionTests } from './portalRegressionTests';

export function registerGlobalTests() {
  if (typeof window !== 'undefined') {
    Object.assign(window, testModule, { runPortalRegressionTests });
  }
}
