#!/bin/bash
# SimplyClik App - Start/Stop/Restart script (FastAPI)
DIR="/home/aiagent/simplyclik-app"
UVICORN="/home/aiagent/mission-control-site/venv/bin/uvicorn"
SERVICES="simplyclik simplyclik-portal simplyclik-tracker"

case "${1:-status}" in
  start)
    systemctl --user start $SERVICES
    echo "Started all services"
    ;;
  stop)
    systemctl --user stop $SERVICES
    echo "Stopped all services"
    ;;
  restart)
    systemctl --user restart $SERVICES
    echo "Restarted all services"
    ;;
  status)
    systemctl --user status $SERVICES 2>/dev/null | grep -E "●|Active:"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    ;;
esac
