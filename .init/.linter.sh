#!/bin/bash
cd /tmp/kavia/workspace/code-generation/to-do-list-application-452f4adb/To_do_list_application_-_Monolithic_Container
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

