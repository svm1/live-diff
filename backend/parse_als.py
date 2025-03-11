import os
import argparse
import gzip
import glob
import xml.etree.ElementTree as ET
from xmldiff import main
from lxml import etree

def remove_path_and_extension(filename):
  """Removes the path and extension from a filename.

  Args:
    filename: The filename to process.

  Returns:
    The filename without the path and extension.
  """
  base_name = os.path.basename(filename)
  name_without_extension = os.path.splitext(base_name)[0]
  return name_without_extension

def delete_XML_files():
    for file in glob.glob("xml-tmp/*.XML"):
        os.remove(file)
        print(f"Deleted {file}")

def midi_to_note(midi_number):
    """Converts a MIDI note number to a human-readable note name."""
    note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    octave = (midi_number // 12) - 1
    note = note_names[midi_number % 12]
    return f"{note}{octave}"  # Example: 64 → E4

class MidiNote:
    """Represents a single MIDI note event."""
    def __init__(self, time, duration, velocity, note_id, midi_key):
        self.time = float(time)
        self.duration = float(duration)
        self.velocity = float(velocity)
        self.note_id = int(note_id)
        self.midi_key = int(midi_key)  # The actual note pitch (C4 = 60, etc.)

    def __repr__(self):
        bar, beat = convert_to_bars_beats(self.time)
        return f"🎵 Note {self.midi_key} (ID {self.note_id}) at Bar {bar}, Beat {beat} (Duration: {self.duration}, Velocity: {self.velocity})"
    
    def __eq__(self, other):
        """Defines equality for comparing two MidiNote objects."""
        return (
            self.time == other.time and
            self.duration == other.duration and
            self.velocity == other.velocity and
            self.note_id == other.note_id and
            self.midi_key == other.midi_key
        )

    def __hash__(self):
        """Allows MidiNote objects to be used in sets and dictionaries."""
        return hash((self.time, self.duration, self.velocity, self.note_id, self.midi_key))


class Clip:
    """Represents a MIDI or Audio Clip in Ableton."""
    def __init__(self, start_time=0, end_time=0):
        self.start_time = float(start_time)
        self.end_time = float(end_time)
        self.notes = []  # Stores MidiNote objects

    def extract_notes(self, clip_xml):
        """Extracts MIDI notes from this specific clip."""
        notes_container = clip_xml.find(".//Notes/KeyTracks")
        if notes_container is None:
            return

        for key_track in notes_container.findall("KeyTrack"):
            midi_key = int(key_track.find("MidiKey").get("Value"))  # The pitch of the notes in this track

            for note in key_track.findall(".//MidiNoteEvent"):
                note_time = float(note.get("Time"))
                note_duration = float(note.get("Duration"))
                note_velocity = float(note.get("Velocity"))
                note_id = int(note.get("NoteId"))

                midi_note = MidiNote(note_time, note_duration, note_velocity, note_id, midi_key)
                self.notes.append(midi_note)

    def __repr__(self):
        return f"Clip(start={self.start_time}, duration={self.end_time - self.start_time}, notes={len(self.notes)})"


class Track:
    """Represents a track in the Ableton project."""
    def __init__(self, track_name, track_type):
        self.name = track_name
        self.type = track_type  # 'M' for MIDI, 'A' for Audio, 'G' for Group, 'R' for Return
        self.clips = []  # Stores Clip objects

    def __repr__(self):
        return f"Track(name={self.name}, type={self.type}, clips={len(self.clips)})"


class LiveSet:
    """Represents an Ableton Live project (ALS file)."""
    def __init__(self, filename):
        self.als_filename = filename
        self.xml_filename = ''
        self.tracks = []
        
    def unpack(self):
        """Extracts XML from ALS file."""

        # print('unpacking ALS')
        # print(f"ALS filename (arg): {self.als_filename}")

        with gzip.open(self.als_filename, 'rb') as unzipped_file:
            content = unzipped_file.read()
            self.xml_filename = os.path.join('xml-tmp', remove_path_and_extension(self.als_filename) + '.xml')

            # print(f"XML filename: {self.xml_filename}")

            # Ensure the directory exists before writing
            os.makedirs('xml-tmp', exist_ok=True)

            with open(self.xml_filename, 'wb') as f:
                f.write(content)  # ALS files use UTF-8

    def parse(self):
        """Parses the XML and extracts track and clip information."""
        tree = ET.parse(self.xml_filename)
        root = tree.getroot()

        live_set = root.find('LiveSet')
        tracks = live_set.find('Tracks')

        for track in tracks:
            name_elem = track.find('Name/EffectiveName')
            if name_elem is not None:
                name = name_elem.get('Value')

                # DEBUG: Check if track appears multiple times
                # print(f"Processing track: {name} (Parent: {track.tag})")

                if track.tag == 'GroupTrack':
                    track_obj = Track(name, 'G')

                elif track.tag == 'MidiTrack':
                    track_obj = Track(name, 'M')
                    track_obj.clips = self.extract_clips(track, "MidiClip")

                elif track.tag == 'AudioTrack':
                    track_obj = Track(name, 'A')
                    track_obj.clips = self.extract_clips(track, "AudioClip")

                elif track.tag == "ReturnTrack":
                    track_obj = Track(name, 'R')

                # print(f"Appending track: {track_obj.name}\n")
                self.tracks.append(track_obj)

        # DEBUG: Print the final list of parsed tracks
        # print(f"\nFinal parsed tracks for {xml_filename}:")
        # for track in self.tracks:
        #     print(f" - {track.name}")

    def extract_clips(self, track, clip_type):
        """Extracts clips and their MIDI notes (if applicable)."""
        clips = []
        for clip_xml in track.findall(f".//{clip_type}"):
            start_time = float(clip_xml.find("CurrentStart").get("Value"))
            end_time = float(clip_xml.find("CurrentEnd").get("Value"))

            clip = Clip(start_time, end_time)
            if clip_type == "MidiClip":
                clip.extract_notes(clip_xml)  # Get MIDI notes

            clips.append(clip)
        return sorted(clips, key=lambda c: c.start_time)  # Sort by start time


def convert_to_bars_beats(time):
    """Convert Ableton's beat-based Time value into bars & beats (4/4 time)."""
    bar = int(time // 4) + 1  # Bar number
    beat = (time % 4) + 1  # Beat within the bar
    return bar, beat


def diff_tracks(track1, track2):
    """Compares two Track objects and prints differences in clips and MIDI notes."""
    print(f"\n🎼 **Comparing track:** {track1.name}")

    if track1.type != track2.type:
        print(f"⚠️ Type mismatch: {track1.type} vs {track2.type}")

    added_clips, removed_clips = diff_clips(track1.clips, track2.clips)

    if added_clips:
        print("➕ **Added Clips to set 2:**", added_clips)
    if removed_clips:
        print("➖ **Removed Clips from set 2:**", removed_clips)
    if not added_clips and not removed_clips:
        print("✅ No structural changes in clip arrangement.")

    if track1.type == "M":
        diff_midi_clip_contents(track1, track2)  # Deep MIDI diff


def diff_clips(clips1, clips2):
    """Compares two clip lists based on start time and duration."""
    set1 = {(clip.start_time, clip.end_time - clip.start_time) for clip in clips1}
    set2 = {(clip.start_time, clip.end_time - clip.start_time) for clip in clips2}

    added = set2 - set1  # Clips in the new version but not in the old
    removed = set1 - set2  # Clips that were in the old version but not in the new

    return added, removed


def diff_midi_clip_contents(track1, track2):
    """Compares MIDI note contents of matching clips."""
    print(f"\n🎵 **Comparing MIDI content for:** {track1.name}")

    num_clips = min(len(track1.clips), len(track2.clips))  # Compare common clips
    print(f"comparing {num_clips} clips for track {track1.name}")

    for i in range(num_clips):
        clip1 = track1.clips[i]
        clip2 = track2.clips[i]

        old_set = set(clip1.notes)  # Set of MidiNote objects (original)
        new_set = set(clip2.notes)  # Set of MidiNote objects (new version)

        added_notes = new_set - old_set
        removed_notes = old_set - new_set
        modified_notes = []

        # Mark notes to be removed AFTER iteration
        to_remove = set()

        for old_note in removed_notes:
            match = next((new_note for new_note in added_notes if new_note.time == old_note.time), None)

            if match:
                modified_notes.append((old_note, match))
                added_notes.remove(match)
                to_remove.add(old_note)  # Mark old note for removal

        # Remove marked notes outside the loop
        removed_notes -= to_remove

        if added_notes or removed_notes or modified_notes:
            print(f"🎹 **Clip {i} MIDI differences:**")

            for note in added_notes:
                print(f"   ➕ Note {midi_to_note(note.midi_key)} at **Bar {convert_to_bars_beats(note.time)}** (Dur: {note.duration}, Vel: {note.velocity})")

            for note in removed_notes:
                print(f"   ➖ Note {midi_to_note(note.midi_key)} at **Bar {convert_to_bars_beats(note.time)}** (Dur: {note.duration}, Vel: {note.velocity})")

            for old_note, new_note in modified_notes:
                changes = []
                
                if old_note.midi_key != new_note.midi_key:
                    changes.append(f"changed from {midi_to_note(old_note.midi_key)} to {midi_to_note(new_note.midi_key)}")
                
                if old_note.duration != new_note.duration:
                    if new_note.duration > old_note.duration:
                        changes.append(f"extended from {old_note.duration} to {new_note.duration} beats")
                    else:
                        changes.append(f"shortened from {old_note.duration} to {new_note.duration} beats")

                if old_note.velocity != new_note.velocity:
                    if new_note.velocity > old_note.velocity:
                        changes.append(f"velocity increased from {old_note.velocity} to {new_note.velocity}")
                    else:
                        changes.append(f"velocity decreased from {old_note.velocity} to {new_note.velocity}")

                change_description = ", ".join(changes)
                print(f"   🔄 Note at **Bar {convert_to_bars_beats(old_note.time)}** {change_description}.")

        else:
            print(f"✅ **Clip {i} has no MIDI differences.**")



# ---- Execution ----
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Compare two Ableton Live Set files.")
    parser.add_argument("file1", help="Path to the first ALS file")
    parser.add_argument("file2", help="Path to the second ALS file")
    args = parser.parse_args()
    # print(args)

    # Process First ALS File
    live_set_1 = LiveSet(args.file1)
    live_set_1.unpack()
    live_set_1.parse()

    # Process Second ALS File
    live_set_2 = LiveSet(args.file2)
    live_set_2.unpack()
    live_set_2.parse()

    # Standalone DEBUG
    # live_set_1 = LiveSet("test_unpacked.xml")
    # live_set_2 = LiveSet("test3_unpacked.xml")

    # Diff
    print(f"Comparing {args.file1} with {args.file2}...")

    print("Tracks in ALS1:", [track.name for track in live_set_1.tracks])
    print("Tracks in ALS2:", [track.name for track in live_set_2.tracks])

    for track1 in live_set_1.tracks:
        matching_track = next((track2 for track2 in live_set_2.tracks if track2.name == track1.name), None)
        if matching_track:
            print("\n__________________________________")
            # print('about to compare track', track1.name)
            diff_tracks(track1, matching_track)

    