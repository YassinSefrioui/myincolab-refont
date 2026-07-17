import MessagesSidebar from '../views/messages/MessagesSidebar.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function SecondaryCol() {
  const { ui } = useApp();
  if (ui.view !== 'messages') return null;
  return (
    <aside id="secondary-col" className="secondary-col" data-tour="messages-sidebar">
      <MessagesSidebar />
    </aside>
  );
}
