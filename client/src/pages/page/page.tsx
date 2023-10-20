import { useParams } from 'react-router-dom';
import Editor from '@/features/editor/editor';

export default function Page() {
  const { pageId } = useParams();

  return <Editor key={pageId} pageId={pageId}  />;
}
