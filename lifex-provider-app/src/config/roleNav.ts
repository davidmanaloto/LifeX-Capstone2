// src/config/roleNav.ts
export interface RoleNavConfig {
  showSpaces: boolean;
  showSchedule: boolean;
  showFaxes: boolean;
  showNewPatient: boolean;
  defaultRoute: string;
}

export function getRoleNavConfig(flags: {
  isAdmin: boolean;
  isDoctor: boolean;
  isNurse: boolean;
  isReceptionist: boolean;
}): RoleNavConfig {
  if (flags.isAdmin) {
    return { showSpaces: false, showSchedule: false, showFaxes: false, showNewPatient: false, defaultRoute: '/admin' };
  }
  if (flags.isReceptionist) {
    return { showSpaces: false, showSchedule: true, showFaxes: true, showNewPatient: true, defaultRoute: '/Calendar/Schedule' };
  }
  if (flags.isDoctor || flags.isNurse) {
    return { showSpaces: true, showSchedule: true, showFaxes: false, showNewPatient: true, defaultRoute: '/Patient?_count=20&_fields=name,email,gender&_sort=-_lastUpdated' };
  }
  // fallback for unassigned roles
  return { showSpaces: true, showSchedule: true, showFaxes: true, showNewPatient: true, defaultRoute: '/getstarted' };
}