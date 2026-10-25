#!/bin/zsh
# Double-click in Finder to update the gallery without editing any code.
cd -- "${0:A:h:h}" || exit 1
python3 scripts/update-gallery.py
gallery_result=$?
if (( gallery_result == 0 )); then
  print '\nDone. Refresh your local preview to see the gallery. Nothing has been deployed.'
else
  print '\nThe gallery could not be updated. Check the message above.'
fi
read '?Press Return to close this window… '
exit $gallery_result
