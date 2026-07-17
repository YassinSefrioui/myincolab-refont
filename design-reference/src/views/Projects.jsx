import { useEffect } from 'react';
import ProjectsList from './projects/ProjectsList.jsx';
import ProjectDetail from './projects/ProjectDetail.jsx';
import TaskModal from './projects/TaskModal.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function Projects() {
  const { ui, setUi, openModal } = useApp();
  const detailId = ui.projectDetail;

  useEffect(() => {
    if (ui.openTaskId != null) {
      const id = ui.openTaskId;
      openModal(<TaskModal cardId={id} />, { wide: true });
      setUi({ openTaskId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.openTaskId]);

  function openProject(id) { setUi({ projectDetail: id, activeProjectId: id }); }
  function backToList() { setUi({ projectDetail: null }); }

  if (detailId) {
    return <ProjectDetail projectId={detailId} onSwitch={openProject} onBack={backToList} />;
  }
  return <ProjectsList onOpenProject={openProject} />;
}
