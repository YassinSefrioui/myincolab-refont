// ============================================================
// Visites guidées interactives — une étape cible un élément du DOM
// (via un attribut data-tour ou une classe stable) et référence des
// clés i18n pour le titre / le texte de l'info-bulle.
// ============================================================
export const TOUR_STEPS = {
  home: [
    { target: '[data-tour="home-greeting"]', titleKey: 'tourHomeGreetingTitle', bodyKey: 'tourHomeGreetingBody' },
    { target: '[data-tour="home-stats"]', titleKey: 'tourHomeStatsTitle', bodyKey: 'tourHomeStatsBody' },
    { target: '[data-tour="home-tasks"]', titleKey: 'tourHomeTasksTitle', bodyKey: 'tourHomeTasksBody' },
    { target: '[data-tour="home-next-meeting"]', titleKey: 'tourHomeMeetingTitle', bodyKey: 'tourHomeMeetingBody' },
    { target: '[data-tour="home-customize"]', titleKey: 'tourHomeCustomizeTitle', bodyKey: 'tourHomeCustomizeBody' },
    { target: '.left-nav', titleKey: 'tourNavTitle', bodyKey: 'tourNavBody' },
  ],
  projects: [
    { target: '[data-tour="projects-header"]', titleKey: 'tourProjectsHeaderTitle', bodyKey: 'tourProjectsHeaderBody' },
    { target: '[data-tour="projects-tabs"]', titleKey: 'tourProjectsTabsTitle', bodyKey: 'tourProjectsTabsBody' },
    { target: '[data-tour="projects-toolbar"]', titleKey: 'tourProjectsToolbarTitle', bodyKey: 'tourProjectsToolbarBody' },
    { target: '[data-tour="projects-grid"]', titleKey: 'tourProjectsGridTitle', bodyKey: 'tourProjectsGridBody' },
  ],
  messages: [
    { target: '[data-tour="messages-sidebar"]', titleKey: 'tourMessagesSidebarTitle', bodyKey: 'tourMessagesSidebarBody' },
    { target: '.chat-title', titleKey: 'tourMessagesInfoTitle', bodyKey: 'tourMessagesInfoBody' },
    { target: '[data-tour="messages-calls"]', titleKey: 'tourMessagesCallsTitle', bodyKey: 'tourMessagesCallsBody' },
    { target: '.chat-input-bar', titleKey: 'tourMessagesInputTitle', bodyKey: 'tourMessagesInputBody' },
  ],
  meet: [
    { target: '[data-tour="meet-header"]', titleKey: 'tourMeetHeaderTitle', bodyKey: 'tourMeetHeaderBody' },
    { target: '[data-tour="meet-actions"]', titleKey: 'tourMeetActionsTitle', bodyKey: 'tourMeetActionsBody' },
    { target: '[data-tour="meet-upcoming"]', titleKey: 'tourMeetUpcomingTitle', bodyKey: 'tourMeetUpcomingBody' },
  ],
  files: [
    { target: '[data-tour="files-header"]', titleKey: 'tourFilesHeaderTitle', bodyKey: 'tourFilesHeaderBody' },
    { target: '[data-tour="files-tabs"]', titleKey: 'tourFilesTabsTitle', bodyKey: 'tourFilesTabsBody' },
    { target: '[data-tour="files-toolbar"]', titleKey: 'tourFilesToolbarTitle', bodyKey: 'tourFilesToolbarBody' },
    { target: '[data-tour="files-list"]', titleKey: 'tourFilesListTitle', bodyKey: 'tourFilesListBody' },
  ],
  calendar: [
    { target: '[data-tour="calendar-header"]', titleKey: 'tourCalendarHeaderTitle', bodyKey: 'tourCalendarHeaderBody' },
    { target: '.cal-month-trigger', titleKey: 'tourCalendarPickerTitle', bodyKey: 'tourCalendarPickerBody' },
    { target: '[data-tour="calendar-grid"]', titleKey: 'tourCalendarGridTitle', bodyKey: 'tourCalendarGridBody' },
    { target: '[data-tour="calendar-upcoming"]', titleKey: 'tourCalendarUpcomingTitle', bodyKey: 'tourCalendarUpcomingBody' },
  ],
  groups: [
    { target: '[data-tour="groups-header"]', titleKey: 'tourGroupsHeaderTitle', bodyKey: 'tourGroupsHeaderBody' },
    { target: '[data-tour="groups-list"]', titleKey: 'tourGroupsListTitle', bodyKey: 'tourGroupsListBody' },
    { target: '[data-tour="groups-manage"]', titleKey: 'tourGroupsManageTitle', bodyKey: 'tourGroupsManageBody' },
  ],
  announcements: [
    { target: '[data-tour="announcements-header"]', titleKey: 'tourAnnouncementsHeaderTitle', bodyKey: 'tourAnnouncementsHeaderBody' },
    { target: '[data-tour="announcements-list"]', titleKey: 'tourAnnouncementsListTitle', bodyKey: 'tourAnnouncementsListBody' },
  ],
  profile: [
    { target: '[data-tour="profile-head"]', titleKey: 'tourProfileHeadTitle', bodyKey: 'tourProfileHeadBody' },
    { target: '[data-tour="profile-prefs"]', titleKey: 'tourProfilePrefsTitle', bodyKey: 'tourProfilePrefsBody' },
    { target: '[data-tour="profile-timezones"]', titleKey: 'tourProfileTimezonesTitle', bodyKey: 'tourProfileTimezonesBody' },
    { target: '[data-tour="profile-security"]', titleKey: 'tourProfileSecurityTitle', bodyKey: 'tourProfileSecurityBody' },
  ],
  admin: [
    { target: '[data-tour="admin-tabs"]', titleKey: 'tourAdminTabsTitle', bodyKey: 'tourAdminTabsBody' },
    { target: '[data-tour="admin-stats"]', titleKey: 'tourAdminStatsTitle', bodyKey: 'tourAdminStatsBody' },
    { target: '[data-tour="admin-quickactions"]', titleKey: 'tourAdminQuickActionsTitle', bodyKey: 'tourAdminQuickActionsBody' },
    { target: '[data-tour="admin-projects-overview"]', titleKey: 'tourAdminProjectsOverviewTitle', bodyKey: 'tourAdminProjectsOverviewBody' },
  ],
};
