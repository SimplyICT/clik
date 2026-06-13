#!/bin/bash
# SimplyClik App - Start/Stop/Restart/Status script
SERVICES="simplyclik simplyclik-portal simplyclik-mobile simplyclik-tracker"

case "${1:-status}" in
  start)
    systemctl --user start $SERVICES
    echo "Started SimplyClik services"
    ;;
  stop)
    systemctl --user stop $SERVICES
    echo "Stopped SimplyClik services"
    ;;
  restart)
    systemctl --user restart $SERVICES
    echo "Restarted SimplyClik services"
    ;;
  status)
    systemctl --user status $SERVICES 2>/dev/null | grep -E "●|Active:"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "  nGinx/SSL: sudo systemctl restart nginx"
    echo "  Cert renewal: sudo certbot renew"
    ;;
esac
