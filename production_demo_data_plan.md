# Production UI Manual Test Plan

Because automated UI testing is restricted, manually test the following states on the LIVE VPS:

## LOGGED OUT
- [ ] homepage renders correctly
- [ ] property discovery (search functions)
- [ ] property detail page renders correctly without error
- [ ] university page lists near universities
- [ ] retail page
- [ ] product page loads without placeholder issues

## RETAILER (shikharshaurya.01@gmail.com)
- [ ] Login
- [ ] Dashboard
- [ ] Catalog
- [ ] Products list
- [ ] Terminal loads
- [ ] Add product functionality
- [ ] Edit product functionality
- [ ] Upload product image (verifies S3/R2 config)
- [ ] POS cart functionality
- [ ] test transaction in sandbox mode

## HOST (allienshaurya@gmail.com)
- [ ] Login
- [ ] Dashboard
- [ ] Properties list
- [ ] Edit property
- [ ] Upload property image (verifies placeholder replaces with actual image)
- [ ] property preview
- [ ] enquiry submission flow

## STUDENT (ssmnvi012@gmail.com)
- [ ] Login
- [ ] Student dashboard
- [ ] property browsing and saving functionality
