#!/bin/bash

componentTemplatesFilePath="../sc-web/client/templates/components.html"
componentJsFolderPath="../sc-web/client/static/components/js/nat-proc/"
kbFolderPath="../kb/Natural-processing/"

if [ -d "$componentJsFolderPath" ]
then
  read -p "Do you want to override existing agent sources? " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]
  then
    cp -rf ./toScWeb/. $componentJsFolderPath
    echo "*** Added agent sources to sc-web"
  fi
else
  cp -rf ./toScWeb/ $componentJsFolderPath
  echo "*** Added agent sources to sc-web"
fi

if [ -d "$kbFolderPath" ]
then
  read -p "Do you want to override existing kb sources? " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]
  then
    cp -rf ./toKb/. $kbFolderPath
    echo "*** Added knowledge base sources to sc-web"
  fi
else
  cp -rf ./toKb/. $kbFolderPath
  echo "*** Added knowledge base sources to sc-web"
fi

if ! grep -q "<!-- Natural language processing dependecies Starts -->" "$componentTemplatesFilePath"; then
echo "
<!-- Natural language processing dependecies Starts -->
<script type="text/javascript" charset="utf-8" src="/static/components/js/nat-proc/nat-proc.js"></script>
<!-- Natural language processing dependecies Ends -->
" >> $componentTemplatesFilePath;
 
echo "*** Declared agent dependencies"
fi

echo "*** Natural language processing module INSTALLED!"


