import './App.css';
import React, {useEffect, useReducer} from 'react';
import { API } from 'aws-amplify';
import { List, Input} from 'antd';
import { listNotes } from './graphql/queries';
import { v4 as uuid } from 'uuid'
import { 
  updateNote as UpdateNote,
  createNote as CreateNote,
  deleteNote as DeleteNote
} from './graphql/mutations';
import { onCreateNote } from './graphql/subscriptions'
import { Container, Typography, Button } from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CancelIcon from '@mui/icons-material/Cancel';

const CLIENT_ID = uuid()

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: { name: '', description: '' }
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes, loading: false };
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes]}
    case 'RESET_FORM':
      return { ...state, form: initialState.form }
    case 'SET_INPUT':
      return { ...state, form: { ...state.form, [action.name]: action.value } }
    case 'ERROR':
      return { ...state, loading: false, error: true };
    default:
      return { ...state };
  }
}


function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchNotes = async () => {
    try {
      const notesData = await API.graphql({
        query: listNotes
      });
      const sortedNotes = notesData.data.listNotes.items.sort((a, b) => a.name.localeCompare(b.name));
      dispatch({ type: 'SET_NOTES', notes: sortedNotes });
    } catch (err) {
      console.log('error: ', err);
      dispatch({ type: 'ERROR' });
    }
  }

  useEffect(() => {
    fetchNotes();
    const subscription = API.graphql({
      query: onCreateNote
    })
      .subscribe({
        next: noteData => {
          const note = noteData.value.data.onCreateNote
          if (CLIENT_ID === note.clientId) return
          dispatch({ type: 'ADD_NOTE', note })
        }
      })
      return () => subscription.unsubscribe()
  }, [])

  async function createNote() {
    const { form } = state
    if (!form.name || !form.description) {
       return alert('please enter a name and description')
    }
    const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() }
    dispatch({ type: 'ADD_NOTE', note })
    dispatch({ type: 'RESET_FORM' })
    try {
      await API.graphql({
        query: CreateNote,
        variables: { input: note }
      })
      console.log('successfully created note!')
    } catch (err) {
      console.log("error: ", err)
    }
  }
  async function deleteNote({ id }) {
    const index = state.notes.findIndex(n => n.id === id)
    const notes = [
      ...state.notes.slice(0, index),
      ...state.notes.slice(index + 1)];
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await API.graphql({
        query: DeleteNote,
        variables: { input: { id } }
      })
      console.log('successfully deleted note!')
      } catch (err) {
        console.log({ err })
    }
  }
  async function updateNote(note) {
    const index = state.notes.findIndex(n => n.id === note.id)
    const notes = [...state.notes]
    notes[index].completed = !note.completed
    dispatch({ type: 'SET_NOTES', notes})
    try {
      await API.graphql({
        query: UpdateNote,
        variables: { input: { id: note.id, completed: notes[index].completed } }
      })
      console.log('note successfully updated!')
    } catch (err) {
      console.log('error: ', err)
    }
  }

  function onChange(e) {
    dispatch({ type: 'SET_INPUT', name: e.target.name, value: e.target.value })
  }

  const styles = {
    container: { padding: 20 },
    input: { marginBottom: 10 },
    item: { textAlign: 'left' },
    p: { color: '#1890ff' }
  };

  function renderItem(item) {
    return (
      <List.Item
        style={styles.item}
        actions={[
          <Button variant="contained" color="error" onClick={() => deleteNote(item)}>Delete</Button>,
          <p style={styles.p} onClick={() => updateNote(item)}>
            {item.completed ? <Button color="success" variant="outlined" >Completed <AssignmentTurnedInIcon/></Button> : <Button color="error" variant="outlined">Not Completed<CancelIcon/></Button>}
          </p>
        ]}
      >
        <List.Item.Meta
        title={item.name}
        description={item.description}
        />
      </List.Item>
    );
  }

  return (

    <Container maxWidth="sm">
      <Typography variant="h4" align="center" gutterBottom style={{ marginTop: '10px' }}>
      Notes App
      </Typography>
      <div style={styles.container}>
        <Input
          onChange={onChange}
          value={state.form.name}
          placeholder="Note Name"
          name='name'
          style={styles.input}
        />
        <Input
          onChange={onChange}
          value={state.form.description}
          placeholder="Note description"
          name='description'
          style={styles.input}
        />
        <Button
          onClick={createNote}
          variant="outlined"
        > 
          <NoteAddIcon/> Add Note
          </Button>
        <List
          loading={state.loading}
          dataSource={state.notes}
          renderItem={renderItem}
        />
      </div>
    </Container>
  );
}

export default App;
