import * as accountProvisioning from './accountProvisioning.activities';
import * as sendEmail from './email.activities';

const allActivities = {
  ...accountProvisioning,
  // ...cloudProvider,
  ...sendEmail,
  // ...keycloakProvisioning,
  // ...workspaceProvisioning,
};

export default allActivities;
export type AllActivities = typeof allActivities;
